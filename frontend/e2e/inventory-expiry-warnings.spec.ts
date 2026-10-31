import { expect, test } from "@playwright/test";
import { selectSection } from "./helpers/select-section";


for (const width of [1440, 390]) {
    test(`lot expiry warnings remain readable at ${width}px`, async ({ context, page }) => {
        test.skip(process.env.E2E_BASE_URL !== "http://localhost:3000", "Local UI regression only");
        await page.setViewportSize({ width, height: 1000 });
        const token = Buffer.from(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600 })).toString("base64url");
        await context.addCookies([{ name: "auth_token", value: `fixture.${token}.not-a-backend-token`, url: "http://localhost:3000" }]);
        await page.addInitScript(() => localStorage.setItem("locale", "es"));
        await page.route("**/api/v1/**", async route => {
            const path = new URL(route.request().url()).pathname.replace(/\/$/, "");
            let body: unknown = [];
            if (path === "/api/v1/users/me") body = { id: 1, full_name: "QA", role: { name: "admin" }, company_id: 1, is_active: true };
            else if (path === "/api/v1/companies/1") body = { id: 1, name: "QA", onboarding_completed: true, subscription_status: "active" };
            else if (path.endsWith("organization/access")) body = { "inventory.read": true, "inventory.manage": true };
            else if (path === "/api/v1/inventory/lots") body = [
                { id: 1, code: "QA-VENCIDO", material_name: "Material QA", warehouse_name: "Almacén QA", available_quantity: "2", expires_at: "2000-01-01", expiry_status: "expired" },
                { id: 2, code: "QA-AVISO", material_name: "Material QA", warehouse_name: "Almacén QA", available_quantity: "3", expires_at: "2026-11-20", expiry_status: "expiring" },
            ];
            await route.fulfill({ json: body });
        });
        await page.goto("/dashboard/inventory");
        await selectSection(page, page, "Lotes", "Vista: Operativa");
        for (const text of ["Caducado", "Caduca pronto"]) {
            const badge = page.getByText(text, { exact: true }).filter({ visible: true });
            await expect(badge).toBeVisible();
            expect(await badge.evaluate(el => {
                const bounds = el.getBoundingClientRect();
                const cell = el.closest("td") ?? el.closest('[data-slot="card"]')!;
                return el.scrollWidth <= el.clientWidth && bounds.right <= cell.getBoundingClientRect().right;
            })).toBe(true);
        }
    });
}
