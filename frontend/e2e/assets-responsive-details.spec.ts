import { expect, test } from "@playwright/test";

for (const width of [1440, 768, 390]) for (const manage of [false, true]) {
    test(`asset details remain available at ${width}px with manage=${manage}`, async ({ context, page }) => {
        test.skip(process.env.E2E_BASE_URL !== "http://localhost:3000", "Local UI regression only");
        await page.setViewportSize({ width, height: 1000 });
        const token = Buffer.from(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600 })).toString("base64url");
        await context.addCookies([{ name: "auth_token", value: `fixture.${token}.not-a-backend-token`, url: "http://localhost:3000" }]);
        await page.addInitScript(() => localStorage.setItem("locale", "es"));
        let writes = 0;
        await page.route("**/api/v1/**", async route => {
            const path = new URL(route.request().url()).pathname.replace(/\/$/, "");
            if (route.request().method() !== "GET") writes++;
            let body: unknown = [];
            if (path === "/api/v1/users/me") body = { id: 1, full_name: "QA", role: { name: manage ? "admin" : "viewer" }, company_id: 1, is_active: true };
            else if (path === "/api/v1/companies/1") body = { id: 1, name: "QA", onboarding_completed: true, subscription_status: "active" };
            else if (path.endsWith("organization/access")) body = { "locations.read": true, "locations.manage": manage };
            else if (path === "/api/v1/locations") body = [{ id: 15, name: "QA Sede", can_manage_location: manage }];
            else if (path === "/api/v1/location-equipment") body = [{ id: 2, name: "QA aspiradora", category: "Limpieza QA", quantity: 2, status: "maintenance", next_service_at: "2026-12-01", location_id: 15, location_name: "QA Sede" }];
            await route.fulfill({ json: body });
        });
        await page.goto("/dashboard/assets");
        await expect(page.getByRole("banner").getByRole("heading", { name: "Activos", exact: true })).toBeVisible();
        await expect(page.getByText("QA aspiradora", { exact: true }).filter({ visible: true })).toBeVisible();
        await expect(page.getByText("Limpieza QA · 2 ud.", { exact: true }).filter({ visible: true })).toBeVisible();
        await expect(page.getByText("01/12/2026", { exact: false }).filter({ visible: true })).toBeVisible();
        await expect(page.getByText("Mantenimiento", { exact: true }).filter({ visible: true })).toBeVisible();
        await expect(page.getByRole("button", { name: "Archivar QA aspiradora", exact: true }).filter({ visible: true })).toHaveCount(manage ? 1 : 0);
        await expect(page.getByRole("table").filter({ visible: true })).toHaveCount(width >= 1024 ? 1 : 0);
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
        expect(writes).toBe(0);
    });
}
