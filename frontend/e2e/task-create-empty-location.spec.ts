import { expect, test } from "@playwright/test";

for (const locale of ["es", "en"] as const) for (const width of [390, 768, 1440]) {
    test(`task creation explains missing locations in ${locale} at ${width}px`, async ({ context, page }) => {
        test.skip(process.env.E2E_BASE_URL !== "http://localhost:3000", "Local UI regression only");
        await page.setViewportSize({ width, height: 1000 });
        const token = Buffer.from(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600 })).toString("base64url");
        await context.addCookies([{ name: "auth_token", value: `fixture.${token}.not-a-backend-token`, url: "http://localhost:3000" }]);
        await page.addInitScript(locale => localStorage.setItem("locale", locale), locale);
        let writes = 0;
        await page.route("**/api/v1/**", async route => {
            const path = new URL(route.request().url()).pathname.replace(/\/$/, "");
            if (route.request().method() !== "GET") writes++;
            let body: unknown = [];
            if (path.endsWith("/users/me")) body = { id: 1, full_name: "QA", company_id: 1, role: { name: "admin" }, is_active: true };
            else if (path.endsWith("/companies/1")) body = { id: 1, name: "QA", onboarding_completed: true, subscription_status: "active" };
            else if (path.endsWith("/work-sessions/active")) body = null;
            await route.fulfill({ json: body });
        });
        await page.goto("/dashboard/tasks");
        await page.getByRole("button", { name: locale === "es" ? "Nueva Tarea" : "New Task", exact: true }).click();
        const dialog = page.getByRole("dialog");
        await expect(dialog.getByText(locale === "es" ? "No hay ubicaciones disponibles para crear tareas." : "No locations are available for creating tasks.", { exact: true })).toBeVisible();
        await expect(dialog.locator('button[type="submit"]')).toBeDisabled();
        await expect(dialog.locator("#task-create-location")).toBeDisabled();
        await dialog.getByRole("link", { name: locale === "es" ? "Ir a Ubicaciones" : "Go to Locations", exact: true }).click();
        await expect(page).toHaveURL(/\/dashboard\/locations$/);
        await expect(page.getByRole("dialog")).toHaveCount(0);
        expect(writes).toBe(0);
    });
}
