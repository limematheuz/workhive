import { expect, test } from "@playwright/test";

// All API traffic is intercepted: responsive regression never changes local data.
for (const width of [1440, 1038, 768, 390, 320]) {
    test(`margin dialog keeps amounts and editing controls usable at ${width}px`, async ({ context, page }) => {
        test.skip(process.env.E2E_BASE_URL !== "http://localhost:3000", "Local UI regression only");
        await page.setViewportSize({ width, height: 900 });
        const payload = Buffer.from(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600 })).toString("base64url");
        await context.addCookies([{ name: "auth_token", value: `fixture.${payload}.not-a-backend-token`, url: "http://localhost:3000" }]);
        await page.addInitScript(() => { localStorage.setItem("locale", "es"); });
        const forecast = {
            scope_type: "work_order", scope_id: 1, scope_name: "Orden de prueba",
            budget: { id: 1, planned_direct_cost_amount: 15, notes: "Base de cálculo de prueba" },
            planned_revenue_base_amount: null, planned_direct_cost_base_amount: 15, planned_margin_base_amount: null,
            actual_revenue_base_amount: 0, actual_labor_cost_base_amount: 0, actual_material_cost_base_amount: 0,
            actual_expense_cost_base_amount: 10, actual_direct_cost_base_amount: 10, actual_margin_base_amount: -10,
            direct_cost_variance_base_amount: -5,
        };
        const writes: unknown[] = [];
        await page.route("**/api/v1/**", async route => {
            const path = new URL(route.request().url()).pathname.replace(/\/$/, "");
            let body: unknown = [];
            if (path === "/api/v1/users/me") body = { id: 1, full_name: "Usuario de prueba", role: { name: "admin" }, company_id: 1, is_active: true };
            else if (path === "/api/v1/companies/1") body = { id: 1, name: "Prueba", onboarding_completed: true, subscription_status: "active" };
            else if (path.includes("entitlements")) body = { entitlements: ["work_orders"].map(name => ({ code: `features.${name}`, value_type: "boolean", value: true })) };
            else if (path === "/api/v1/work-orders") body = [{ id: 1, title: "Orden de prueba con nombre largo para comprobar su cabecera", location_id: 1, status: "cancelled", order_type: "one_off" }];
            else if (path === "/api/v1/locations") body = [{ id: 1, name: "Ubicación de prueba" }];
            else if (path === "/api/v1/margin-forecasts/work-orders/1") {
                if (route.request().method() === "PUT") writes.push(route.request().postDataJSON());
                body = forecast;
            }
            else if (path.includes("alert-count")) body = { pending_requests: 0, pending_tasks: 0, unread_reports: 0 };
            await route.fulfill({ json: body });
        });
        await page.goto("/dashboard/work-orders");
        await page.getByRole("button", { name: "Margen", exact: true }).filter({ visible: true }).click();
        const dialog = page.getByRole("dialog");
        const notes = dialog.getByLabel("Base de cálculo interna");
        await expect(notes).toHaveValue("Base de cálculo de prueba");
        const metrics = dialog.getByRole("region", { name: "Resumen de margen de orden" });
        await expect(metrics.getByRole("article")).toHaveCount(4);
        for (const card of await metrics.getByRole("article").all()) {
            expect(await card.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
            for (const text of await card.locator("p").all()) {
                expect(await text.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
            }
        }
        expect(await dialog.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
        const bounds = await dialog.boundingBox();
        expect(bounds!.x).toBeGreaterThanOrEqual(0);
        expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(width);
        const notesBox = await notes.boundingBox();
        expect(notesBox!.width).toBeGreaterThanOrEqual(width <= 390 ? 200 : 260);
        const save = dialog.getByRole("button", { name: "Guardar coste" });
        const saveBox = await save.boundingBox();
        expect(saveBox!.y).toBeGreaterThanOrEqual(notesBox!.y + notesBox!.height);
        await notes.fill("Nota de prueba editable sin comprimir");
        await expect(notes).toHaveValue("Nota de prueba editable sin comprimir");
        await dialog.getByRole("button", { name: "Close", exact: true }).click();
        await expect(page.getByRole("alertdialog")).toBeVisible();
        await page.getByRole("button", { name: "Seguir editando", exact: true }).click();
        await expect(notes).toHaveValue("Nota de prueba editable sin comprimir");
        if (width === 1440) {
            await page.route("**/api/v1/margin-forecasts/work-orders/1", route => route.fulfill({ status: 503, json: { detail: "No disponible temporalmente" } }), { times: 1 });
            await save.click();
            await expect(save).toBeEnabled();
            await dialog.getByRole("button", { name: "Close", exact: true }).click();
            await expect(page.getByRole("alertdialog")).toBeVisible();
            await page.getByRole("button", { name: "Seguir editando", exact: true }).click();
            await expect(notes).toHaveValue("Nota de prueba editable sin comprimir");
        }
        await save.click();
        await expect.poll(() => writes.length).toBe(1);
        expect(writes[0]).toEqual({ planned_direct_cost_amount: 15, notes: "Nota de prueba editable sin comprimir" });
        await expect(save).toBeEnabled();
        if (width === 1440) {
            await notes.fill("Cambio posterior al guardado");
            await dialog.getByRole("button", { name: "Close", exact: true }).click();
            await expect(page.getByRole("alertdialog")).toBeVisible();
            await page.getByRole("button", { name: "Seguir editando", exact: true }).click();
            await save.click();
            await expect.poll(() => writes.length).toBe(2);
            await expect(save).toBeEnabled();
        }
        await dialog.getByRole("button", { name: "Close", exact: true }).click();
        await expect(dialog).toBeHidden();
        await expect(page.getByRole("alertdialog")).toHaveCount(0);
    });
}
