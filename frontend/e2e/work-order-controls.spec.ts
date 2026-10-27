import { expect, test, type Page } from "@playwright/test";

test.use({ timezoneId: "UTC" });

const title = "Orden QA de recurrencia y planificación";

test.beforeEach(async ({ context, page }) => {
    test.skip(process.env.E2E_BASE_URL !== "http://localhost:3000", "Local intercepted regression only");
    const payload = Buffer.from(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600 })).toString("base64url");
    await context.addCookies([{ name: "auth_token", value: `fixture.${payload}.not-a-backend-token`, url: "http://localhost:3000" }]);
    await page.addInitScript(() => localStorage.setItem("locale", "es"));
    let order = { id: 1, title, location_id: 1, service_contract_id: null, status: "active", order_type: "recurring", scheduled_start_at: "2026-10-13T08:44:00Z", next_occurrence_at: "2026-10-21T08:44:17.123Z", recurrence_unit: "weekly", recurrence_interval: 1, recurrence_ends_at: null, estimated_people: 1, estimated_minutes: 20, description: "QA original" };
    await page.route("**/api/v1/**", async route => {
        const path = new URL(route.request().url()).pathname.replace(/\/$/, "");
        let body: unknown = [];
        if (path === "/api/v1/users/me") body = { id: 1, full_name: "QA", role: { name: "admin" }, company_id: 1, is_active: true };
        else if (path === "/api/v1/companies/1") body = { id: 1, name: "QA", onboarding_completed: true, subscription_status: "active" };
        else if (path.includes("entitlements")) body = { entitlements: [{ code: "features.work_orders", value_type: "boolean", value: true }] };
        else if (path === "/api/v1/work-orders") body = [order, { ...order, id: 2, title: "Orden cancelada", status: "cancelled", order_type: "one_off" }];
        else if (path === "/api/v1/work-orders/1") {
            if (route.request().method() === "PATCH") order = { ...order, ...route.request().postDataJSON() };
            body = order;
        }
        else if (path === "/api/v1/work-orders/1/generate") body = { work_order: { ...order, next_occurrence_at: "2026-10-28T08:44:00Z" }, task_item_id: 30 };
        else if (path === "/api/v1/locations") body = [{ id: 1, name: "Ubicación QA", can_manage_tasks: true }];
        else if (path.includes("alert-count")) body = { pending_requests: 0, pending_tasks: 0, unread_reports: 0 };
        await route.fulfill({ json: body });
    });
});

async function openEditor(page: Page) {
    await page.goto("/dashboard/work-orders");
    // A row can open the editor; all secondary actions belong to its menu.
    await page.getByRole("button", { name: `Acciones de ${title}`, exact: true }).filter({ visible: true }).click();
    await page.getByRole("menuitem", { name: "Editar", exact: true }).click();
    return page.getByRole("dialog", { name: "Editar orden de trabajo", exact: true });
}

for (const width of [1440, 1280, 1038, 768, 390, 320]) {
    test(`work order actions and badges fit at ${width}px`, async ({ page }) => {
        await page.setViewportSize({ width, height: 1000 });
        await page.goto("/dashboard/work-orders");
        const trigger = page.getByRole("button", { name: `Acciones de ${title}`, exact: true }).filter({ visible: true });
        await expect(trigger).toBeVisible();
        expect(await page.locator("main").evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
        for (const badge of await page.locator('[data-slot="badge"]').filter({ visible: true }).all()) {
            expect(await badge.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
            expect(await badge.evaluate(el => el.getBoundingClientRect().right <= el.parentElement!.getBoundingClientRect().right + 1)).toBe(true);
        }
        for (const th of await page.getByRole("columnheader").filter({ visible: true }).all()) {
            expect(await th.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
        }
        await trigger.click();
        await expect(page.getByRole("menuitem", { name: "Editar", exact: true })).toBeVisible();
        await expect(page.getByRole("menuitem", { name: "Material", exact: true })).toBeVisible();
        await expect(page.getByRole("menuitem", { name: "Margen", exact: true })).toBeVisible();
        await page.getByRole("menuitem", { name: "Generar tarea", exact: true }).click();
        await expect(page.getByText("Tarea ejecutable creada desde la orden.", { exact: true })).toBeVisible();
        await page.getByRole("button", { name: "Acciones de Orden cancelada", exact: true }).filter({ visible: true }).click();
        await expect(page.getByRole("menuitem", { name: "Generar tarea", exact: true })).toHaveCount(0);
    });
}

for (const width of [1280, 768, 390]) {
    test(`work order date and exact minutes can be saved at ${width}px`, async ({ page }) => {
        await page.setViewportSize({ width, height: 1000 });
        const editor = await openEditor(page);
        await expect(editor.getByRole("combobox", { name: "Hora de Próxima planificación", exact: true })).toHaveText(/08:44/);
        const ends = editor.getByRole("textbox", { name: "Finaliza", exact: true });
        expect((await ends.boundingBox())!.width).toBeGreaterThanOrEqual(150);
        await editor.getByRole("button", { name: "Abrir calendario", exact: true }).nth(1).click();
        await page.locator('[data-day="2026-10-28"]').click();
        await expect(ends).toHaveValue("28/10/2026");
        const request = page.waitForRequest(req => req.method() === "PATCH" && req.url().endsWith("/work-orders/1"));
        await editor.getByRole("button", { name: "Guardar cambios", exact: true }).click();
        const saved = (await request).postDataJSON();
        expect(saved).not.toHaveProperty("next_occurrence_at");
        expect(saved.recurrence_ends_at).toBe("2026-10-28T09:00:00.000Z");
        await expect(editor).toHaveCount(0);
        await page.getByRole("button", { name: `Acciones de ${title}`, exact: true }).filter({ visible: true }).click();
        await page.getByRole("menuitem", { name: "Editar", exact: true }).click();
        await expect(ends).toHaveValue("28/10/2026");
        await editor.getByRole("button", { name: "Borrar fecha y hora", exact: true }).click();
        await expect(ends).toHaveValue("");
        await editor.getByRole("combobox", { name: "Hora de Próxima planificación", exact: true }).click();
        await page.getByRole("option", { name: "08:30", exact: true }).click();
        await editor.getByRole("button", { name: "Close", exact: true }).click();
        await expect(page.getByRole("alertdialog")).toBeVisible();
        await page.getByRole("button", { name: "Seguir editando", exact: true }).click();
        await expect(editor.getByRole("combobox", { name: "Hora de Próxima planificación", exact: true })).toHaveText(/08:30/);
        const rescheduled = page.waitForRequest(req => req.method() === "PATCH" && req.url().endsWith("/work-orders/1"));
        await editor.getByRole("button", { name: "Guardar cambios", exact: true }).click();
        expect((await rescheduled).postDataJSON()).toMatchObject({ next_occurrence_at: "2026-10-21T08:30:00.000Z", recurrence_ends_at: null });
        await expect(editor).toHaveCount(0);
    });
}


test("work order menu preserves financial visibility rules", async ({ page }) => {
    await page.route("**/api/v1/users/me", route => route.fulfill({ json: { id: 2, full_name: "QA sin finanzas", role: { name: "viewer" }, company_id: 1, is_active: true } }));
    await page.goto("/dashboard/work-orders");
    await page.getByRole("button", { name: `Acciones de ${title}`, exact: true }).filter({ visible: true }).click();
    await expect(page.getByRole("menuitem", { name: "Margen", exact: true })).toHaveCount(0);
});
