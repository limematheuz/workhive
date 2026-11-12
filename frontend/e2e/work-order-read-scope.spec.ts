import { expect, test } from "@playwright/test";

for (const scopedManager of [false, true]) for (const width of [390, 768, 1440]) {
    test(`work order readers keep permitted data with scoped management ${scopedManager} at ${width}px`, async ({ context, page }) => {
        test.skip(process.env.E2E_BASE_URL !== "http://localhost:3000", "Local UI regression only");
        await page.setViewportSize({ width, height: 1000 });
        const token = Buffer.from(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600 })).toString("base64url");
        await context.addCookies([{ name: "auth_token", value: `fixture.${token}.not-a-backend-token`, url: "http://localhost:3000" }]);
        await page.addInitScript(() => localStorage.setItem("locale", "es"));
        let contractReads = 0;
        let writes = 0;
        let failRead = !scopedManager && width === 390;
        await page.route("**/api/v1/**", async route => {
            const path = new URL(route.request().url()).pathname.replace(/\/$/, "");
            if (route.request().method() !== "GET") writes++;
            if (path.endsWith("/work-orders") && failRead) { await route.fulfill({ status: 503, json: { detail: "Unavailable" } }); return; }
            let body: unknown = [];
            if (path.endsWith("/users/me")) body = { id: 2, full_name: "QA Lector", role: { name: "viewer" }, company_id: 1, is_active: true };
            else if (path.endsWith("/companies/1")) body = { id: 1, name: "QA", onboarding_completed: true, subscription_status: "active" };
            else if (path.endsWith("/work-orders/contract-candidates")) { contractReads++; await route.fulfill({ status: scopedManager ? 200 : 403, json: scopedManager ? [] : { detail: "Forbidden" } }); return; }
            else if (path.endsWith("/locations")) body = [{ id: 1, name: "QA Norte", can_manage_tasks: false }, { id: 2, name: "QA Sur", can_manage_tasks: scopedManager }];
            else if (path.endsWith("/work-orders")) body = [1, 2].map(id => ({ id, title: id === 1 ? "QA Orden visible" : "QA Orden sur", location_id: id, status: "active", order_type: "recurring", scheduled_start_at: "2026-11-12T09:00:00Z", next_occurrence_at: "2026-11-19T09:00:00Z", recurrence_unit: "weekly", recurrence_interval: 1, recurrence_ends_at: null, description: "Indicaciones QA" }));
            await route.fulfill({ json: body });
        });
        await page.goto("/dashboard/work-orders");
        if (failRead) {
            await expect(page.getByRole("alert").filter({ hasText: "No se pudieron cargar todos los datos" })).toBeVisible();
            await expect(page.getByText("Crea una orden para planificar el próximo trabajo.", { exact: true })).toHaveCount(0);
            failRead = false;
            await page.getByRole("button", { name: "Reintentar", exact: true }).click();
        }
        await expect(page.getByText("QA Orden visible", { exact: true }).filter({ visible: true })).toBeVisible();
        await expect(page.getByRole("button", { name: "Nueva orden", exact: true })).toHaveCount(scopedManager ? 1 : 0);
        await page.getByRole("button", { name: "Acciones de QA Orden visible", exact: true }).filter({ visible: true }).click();
        await expect(page.getByRole("menuitem", { name: "Editar", exact: true })).toHaveCount(0);
        await expect(page.getByRole("menuitem", { name: "Generar tarea", exact: true })).toHaveCount(0);
        await page.getByRole("menuitem", { name: "Ver detalles", exact: true }).click();
        const dialog = page.getByRole("dialog", { name: "Detalles de la orden", exact: true });
        await expect(dialog.locator("#work-order-edit-title")).toHaveValue("QA Orden visible");
        await expect(dialog.locator("#work-order-edit-title")).toBeDisabled();
        await expect(dialog.getByRole("button", { name: "Guardar cambios", exact: true })).toHaveCount(0);
        await expect(dialog.getByText("Solo lectura", { exact: true })).toBeVisible();
        await expect(dialog.getByRole("heading", { name: "Detalles de la orden", exact: true })).toBeInViewport();
        await expect(dialog.getByRole("button", { name: "Cerrar", exact: true })).toBeInViewport();
        await dialog.getByRole("button", { name: "Cerrar", exact: true }).click();
        await page.getByRole("button", { name: "Acciones de QA Orden sur", exact: true }).filter({ visible: true }).click();
        await expect(page.getByRole("menuitem", { name: "Editar", exact: true })).toHaveCount(scopedManager ? 1 : 0);
        await expect(page.getByRole("menuitem", { name: "Generar tarea", exact: true })).toHaveCount(scopedManager ? 1 : 0);
        expect(contractReads).toBe(scopedManager ? 1 : 0);
        expect(writes).toBe(0);
    });
}
