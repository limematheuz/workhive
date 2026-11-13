import { expect, test } from "@playwright/test";

for (const width of [390, 768, 1024, 1440]) {
    test(`document download and archive stay inside their action area at ${width}px`, async ({ context, page }) => {
        test.skip(process.env.E2E_BASE_URL !== "http://localhost:3000", "Local UI regression only");
        await page.setViewportSize({ width, height: 1000 });
        const token = Buffer.from(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600 })).toString("base64url");
        await context.addCookies([{ name: "auth_token", value: `fixture.${token}.not-a-backend-token`, url: "http://localhost:3000" }]);
        await page.addInitScript(() => localStorage.setItem("locale", "es"));
        await page.route("**/api/v1/**", async route => {
            const path = new URL(route.request().url()).pathname.replace(/\/$/, "");
            let body: unknown = [];
            if (path.endsWith("/users/me")) body = { id: 1, company_id: 1, role: { name: "admin" }, full_name: "QA", is_active: true };
            else if (path.endsWith("/companies/1")) body = { id: 1, name: "QA", onboarding_completed: true, subscription_status: "active" };
            else if (path.endsWith("/locations")) body = [{ id: 1, name: "Ubicación QA", can_manage_location: true }];
            else if (path.endsWith("/location-documents")) body = [{ id: 1, location_id: 1, location_name: "Ubicación QA", name: "Documento QA.png", document_type: "other", size_bytes: 1024, created_at: "2026-11-13T12:00:00Z" }];
            await route.fulfill({ json: body });
        });
        await page.goto("/dashboard/documents");
        const download = page.locator('a[href$="/documents/1/download"]').filter({ visible: true });
        await expect(download).toBeVisible();
        const bounds = await download.evaluate(el => {
            const link = el.getBoundingClientRect();
            const area = el.parentElement!.getBoundingClientRect();
            return { left: link.left, right: link.right, areaLeft: area.left, areaRight: area.right };
        });
        expect(bounds.left).toBeGreaterThanOrEqual(bounds.areaLeft - 1);
        expect(bounds.right).toBeLessThanOrEqual(bounds.areaRight + 1);
        await page.getByRole("button", { name: "Archivar Documento QA.png", exact: true }).filter({ visible: true }).click();
        await expect(page.getByRole("dialog", { name: "Archivar documento", exact: true })).toBeVisible();
        await page.getByRole("button", { name: "Cancelar", exact: true }).click();
        await expect(download).toBeVisible();
    });
}
