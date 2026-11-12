import { expect, test } from "@playwright/test";

for (const locale of ["es", "en"] as const) for (const width of [390, 768, 1440]) {
    test(`work order validates location and quantities before writing in ${locale} at ${width}px`, async ({ context, page }) => {
        test.skip(process.env.E2E_BASE_URL !== "http://localhost:3000", "Local UI regression only");
        await page.setViewportSize({ width, height: 1000 });
        const token = Buffer.from(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600 })).toString("base64url");
        await context.addCookies([{ name: "auth_token", value: `fixture.${token}.not-a-backend-token`, url: "http://localhost:3000" }]);
        await page.addInitScript(locale => localStorage.setItem("locale", locale), locale);
        const writes: Record<string, unknown>[] = [];
        const errors: string[] = [];
        page.on("pageerror", error => errors.push(error.message));
        await page.route("**/api/v1/**", async route => {
            const path = new URL(route.request().url()).pathname.replace(/\/$/, "");
            let body: unknown = [];
            if (path.endsWith("/users/me")) body = { id: 1, full_name: "QA", role: { name: "admin" }, company_id: 1, is_active: true };
            else if (path.endsWith("/companies/1")) body = { id: 1, name: "QA", onboarding_completed: true, subscription_status: "active" };
            else if (path.endsWith("/locations")) body = [{ id: 1, name: "QA Norte", can_manage_tasks: true }];
            else if (path.endsWith("/work-orders") && route.request().method() === "POST") {
                const payload = route.request().postDataJSON();
                writes.push(payload);
                body = { ...payload, id: 100 };
            }
            await route.fulfill({ json: body });
        });
        await page.goto("/dashboard/work-orders");
        await page.getByRole("button", { name: "Nueva orden", exact: true }).click();
        const dialog = page.getByRole("dialog");
        await dialog.locator("#work-order-title").fill("QA Validación");
        await dialog.getByRole("button", { name: "Crear orden", exact: true }).click();
        await expect(page.getByText(locale === "es" ? "Selecciona una ubicación disponible para continuar." : "Choose an available location to continue.", { exact: true })).toBeVisible();
        expect(writes).toHaveLength(0);
        await expect(dialog.locator("#work-order-location")).toBeFocused();
        await expect(dialog.getByRole("heading", { name: "Nueva orden de trabajo", exact: true })).toBeInViewport();
        await expect(dialog.getByRole("button", { name: "Crear orden", exact: true })).toBeInViewport();
        expect(await dialog.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
        await dialog.locator("#work-order-location").click();
        await page.getByRole("option", { name: "QA Norte", exact: true }).click();
        await dialog.locator("#work-order-people").fill("0");
        await dialog.getByRole("button", { name: "Crear orden", exact: true }).click();
        await expect(dialog.locator("#work-order-people")).toBeFocused();
        expect(writes).toHaveLength(0);
        await dialog.locator("#work-order-people").fill("2");
        await dialog.locator("#work-order-minutes").fill("30");
        await dialog.getByRole("button", { name: "Crear orden", exact: true }).click();
        await expect(dialog).toHaveCount(0);
        expect(writes).toHaveLength(1);
        expect(writes[0]).toMatchObject({ title: "QA Validación", location_id: 1, estimated_people: 2, estimated_minutes: 30, status: "active" });
        expect(errors).toEqual([]);
    });
}
