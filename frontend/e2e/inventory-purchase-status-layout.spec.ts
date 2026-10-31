import { expect, test } from "@playwright/test";
import { selectSection } from "./helpers/select-section";

for (const width of [1440, 1091, 1032, 768, 390]) {
    test(`purchase status and correction fit at ${width}px`, async ({ context, page }) => {
        test.skip(process.env.E2E_BASE_URL !== "http://localhost:3000", "Local UI regression only");
        await page.setViewportSize({ width, height: 1000 });
        const token = Buffer.from(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600 })).toString("base64url");
        await context.addCookies([{ name: "auth_token", value: `fixture.${token}.not-a-backend-token`, url: "http://localhost:3000" }]);
        await page.addInitScript(() => localStorage.setItem("locale", "es"));
        let writes = 0;
        const purchase = { id: 1, supplier_id: 1, supplier_name_snapshot: "QA proveedor fechas lote", status: "received", reference: "QA-FECHAS", lines: [{ id: 1 }], expense: { expense_date: "2026-10-31T12:00:00Z", description: "QA recepción inicial fecha lote", total_amount: 2 } };
        await page.route("**/api/v1/**", async route => {
            const path = new URL(route.request().url()).pathname.replace(/\/$/, "");
            if (route.request().method() !== "GET") writes++;
            let body: unknown = [];
            if (path === "/api/v1/users/me") body = { id: 1, full_name: "QA", role: { name: "admin" }, company_id: 1, is_active: true, can_view_finance: true };
            else if (path === "/api/v1/companies/1") body = { id: 1, name: "QA", onboarding_completed: true, subscription_status: "active" };
            else if (path.endsWith("organization/access")) body = { "inventory.read": true, "inventory.manage": true };
            else if (path === "/api/v1/inventory/purchases") body = [purchase, { ...purchase, id: 2, status: "reversed" }];
            await route.fulfill({ json: body });
        });
        await page.goto("/dashboard/inventory");
        await selectSection(page, page, "Compras", "Área de inventario");
        for (const status of ["Recibida", "Corregida"]) {
            const label = page.getByText(status, { exact: true }).filter({ visible: true });
            await expect(label).toBeVisible();
            const size = await label.evaluate(element => {
                const rect = element.getBoundingClientRect();
                const style = getComputedStyle(element);
                const range = document.createRange();
                range.selectNodeContents(element);
                return { height: rect.height, intrinsic: parseFloat(style.lineHeight) + parseFloat(style.paddingTop) + parseFloat(style.paddingBottom) + parseFloat(style.borderTopWidth) + parseFloat(style.borderBottomWidth), width: rect.width, text: range.getBoundingClientRect().width };
            });
            expect(size.width).toBeGreaterThanOrEqual(size.text);
            expect(size.height).toBeLessThanOrEqual(size.intrinsic + 1);
        }
        if (width >= 1024) {
            const row = page.getByRole("row").filter({ hasText: "Recibida" });
            const statusBox = await row.getByText("Recibida", { exact: true }).boundingBox();
            const actionBox = await row.getByRole("button", { name: "Corregir", exact: true }).boundingBox();
            expect(Math.abs(statusBox!.y + statusBox!.height / 2 - actionBox!.y - actionBox!.height / 2)).toBeLessThan(2);
        }
        const correction = page.getByRole("button", { name: "Corregir", exact: true }).filter({ visible: true });
        const position = await correction.evaluate(element => ({ right: element.getBoundingClientRect().right, limit: (element.closest("td") ?? element.closest('[data-slot="card"]')!).getBoundingClientRect().right }));
        expect(position.right).toBeLessThanOrEqual(position.limit);
        await correction.click();
        await expect(page.getByRole("dialog", { name: "Corregir compra", exact: true })).toBeVisible();
        expect(writes).toBe(0);
    });
}
