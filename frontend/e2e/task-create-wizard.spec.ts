import { expect, test } from "@playwright/test";

for (const locale of ["es", "en"] as const) for (const width of [390, 768, 1440]) {
    test(`task wizard preserves edits and creates only after review in ${locale} at ${width}px`, async ({ context, page }) => {
        test.skip(process.env.E2E_BASE_URL !== "http://localhost:3000", "Local UI regression only");
        await page.setViewportSize({ width, height: 1000 });
        const token = Buffer.from(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600 })).toString("base64url");
        await context.addCookies([{ name: "auth_token", value: `fixture.${token}.not-a-backend-token`, url: "http://localhost:3000" }]);
        await page.addInitScript(locale => localStorage.setItem("locale", locale), locale);
        const writes: Record<string, unknown>[] = [];
        const template = { id: 7, name: "QA Servicio", description: "- [ ] QA paso", unit: "service", default_price: 20, pricing_mode: "fixed", is_active: true };
        const location = { id: 1, name: "QA Norte", address: "QA", owner_company_id: 1, managing_company_id: 1, is_active: true };
        await page.route("**/api/v1/**", async route => {
            const path = new URL(route.request().url()).pathname.replace(/\/$/, "");
            let body: unknown = [];
            if (path.endsWith("/users/me")) body = { id: 1, full_name: "QA Admin", company_id: 1, role: { name: "admin" }, is_active: true };
            else if (path.endsWith("/users")) body = [{ id: 1, full_name: "QA Admin", company_id: 1, is_active: true }, { id: 2, full_name: "QA Equipo", company_id: 1, is_active: true }];
            else if (path.endsWith("/companies/1")) body = { id: 1, name: "QA", onboarding_completed: true, subscription_status: "active" };
            else if (path.endsWith("/locations/1/templates")) body = [{ id: 1, template_task_id: 7, custom_price: null, template }];
            else if (path.endsWith("/template-tasks")) body = [template];
            else if (path.endsWith("/locations")) body = [location];
            else if (path.endsWith("/work-sessions/active")) body = null;
            else if (path.endsWith("/task-items") && route.request().method() === "POST") {
                const payload = route.request().postDataJSON();
                writes.push(payload);
                body = { ...payload, id: 50, status: "pending" };
            }
            await route.fulfill({ json: body });
        });
        await page.goto("/dashboard/tasks");
        await page.getByRole("button", { name: locale === "es" ? "Nueva Tarea" : "New Task", exact: true }).click();
        const dialog = page.getByRole("dialog");
        const next = dialog.getByRole("button", { name: locale === "es" ? "Siguiente" : "Next", exact: true });
        await expect(next).toBeEnabled();
        await dialog.locator("#task-create-location").click();
        await page.getByRole("option", { name: "QA Norte", exact: true }).click();
        await next.click();
        await expect(dialog.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "2");
        await dialog.locator("#toggleChecklist").uncheck();
        await expect(next).toBeDisabled();
        expect(writes).toHaveLength(0);
        await dialog.locator("#toggleChecklist").check();
        await dialog.locator("#task-create-default-assignee").click();
        await page.getByRole("option", { name: "QA Equipo", exact: true }).click();
        await dialog.getByRole("textbox", { name: /^Tarifa:|^Rate:/ }).fill("35");
        await next.click();
        await expect(dialog.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "3");
        await expect(dialog.getByText("QA Equipo", { exact: true })).toBeVisible();
        await expect(dialog.getByText("35 € / service", { exact: true })).toBeVisible();
        const dialogBox = await dialog.boundingBox();
        const submitBox = await dialog.locator('button[type="submit"]').boundingBox();
        expect(submitBox?.x).toBeGreaterThanOrEqual(dialogBox!.x);
        expect(submitBox!.x + submitBox!.width).toBeLessThanOrEqual(dialogBox!.x + dialogBox!.width);
        expect(writes).toHaveLength(0);
        await dialog.getByRole("button", { name: locale === "es" ? "Anterior" : "Back", exact: true }).click();
        await expect(dialog.getByRole("textbox", { name: /^Tarifa:|^Rate:/ })).toHaveValue("35");
        await expect(dialog.locator("#task-create-default-assignee")).toContainText("QA Equipo");
        await next.click();
        await dialog.locator('button[type="submit"]').click();
        await expect(dialog).toHaveCount(0);
        expect(writes).toHaveLength(1);
        expect(writes[0]).toMatchObject({ location_id: 1, user_id: 2, template_task_id: 7, price: 35 });
    });
}
