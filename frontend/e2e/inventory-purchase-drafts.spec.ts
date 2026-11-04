import { expect, test } from "@playwright/test";
import { selectSection } from "./helpers/select-section";

for (const width of [390, 768, 1440]) {
    for (const kind of ["create", "correct"] as const) {
        test(`${kind} purchase cancel protects and discards its draft at ${width}px`, async ({ context, page }) => {
            test.skip(process.env.E2E_BASE_URL !== "http://localhost:3000", "Local UI regression only");
            await page.setViewportSize({ width, height: 900 });
            const token = Buffer.from(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600 })).toString("base64url");
            await context.addCookies([{ name: "auth_token", value: `fixture.${token}.not-a-backend-token`, url: "http://localhost:3000" }]);
            await page.addInitScript(() => localStorage.setItem("locale", "es"));
            let writes = 0;
            await page.route("**/api/v1/**", async route => {
                const path = new URL(route.request().url()).pathname.replace(/\/$/, "");
                if (route.request().method() !== "GET") writes++;
                let body: unknown = [];
                if (path === "/api/v1/users/me") body = { id: 1, full_name: "QA", role: { name: "admin" }, company_id: 1, is_active: true, can_view_finance: true };
                else if (path === "/api/v1/companies/1") body = { id: 1, name: "QA", onboarding_completed: true, subscription_status: "active" };
                else if (path.endsWith("/organization/access")) body = { "inventory.read": true, "inventory.manage": true };
                else if (path.endsWith("/inventory/suppliers")) body = [{ id: 1, name: "QA proveedor" }];
                else if (path.endsWith("/inventory/materials")) body = [{ id: 2, name: "QA material", sku: "QA-2", unit: "unit", reorder_point: "0" }];
                else if (path.endsWith("/inventory/warehouses")) body = [{ id: 3, name: "QA almacén" }];
                else if (path.endsWith("/inventory/purchases")) body = [{ id: 4, supplier_id: 1, supplier_name_snapshot: "QA proveedor", supplier_tax_id_snapshot: null, expense_id: 5, reference: null, status: "received", lines: [{ id: 6, material_id: 2, warehouse_id: 3, movement_id: 7, lot_id: null, quantity: "1", unit_cost: "2" }], expense: { id: 5, expense_date: "2026-10-31T12:00:00Z", description: "QA compra", base_amount: 2, tax_amount: 0, total_amount: 2, is_active: true } }];
                await route.fulfill({ json: body });
            });
            await page.goto("/dashboard/inventory");
            await selectSection(page, page, "Compras", "Área de inventario");
            const opener = page.getByRole("button", { name: kind === "create" ? "Nueva compra" : "Corregir", exact: true }).filter({ visible: true });
            await opener.click();
            const dialog = page.getByRole("dialog", { name: kind === "create" ? "Nueva compra de material" : "Corregir compra", exact: true });
            if (kind === "create") {
                const expiry = dialog.getByLabel("Caducidad del lote 1", { exact: true });
                const calendar = expiry.locator("..").getByRole("button", { name: "Abrir calendario", exact: true });
                await expect(expiry).toBeDisabled();
                await expect(calendar).toBeDisabled();
                const lot = dialog.getByLabel("Lote 1", { exact: true });
                await lot.fill("QA-CALENDAR");
                await expect(calendar).toBeEnabled();
                await expiry.fill("04/11/2026");
                await calendar.click();
                await page.locator('[data-day="2026-11-05"]').click();
                await expect(expiry).toHaveValue("05/11/2026");
                await lot.fill("");
                await expect(expiry).toHaveValue("");
                await expect(calendar).toBeDisabled();
                await dialog.getByRole("button", { name: "Añadir línea", exact: true }).click();
                for (const name of ["Material 1", "Almacén 1", "Cantidad 1", "Coste unitario 1"]) {
                    const bounds = await dialog.getByLabel(name, { exact: true }).evaluate(element => {
                        const r = element.getBoundingClientRect();
                        return { left: r.left, right: r.right, width: Math.min(window.innerWidth, element.closest("form")!.getBoundingClientRect().right) };
                    });
                    expect(bounds.left).toBeGreaterThanOrEqual(0);
                    expect(bounds.right).toBeLessThanOrEqual(bounds.width);
                }
            }
            if (kind === "create") {
                for (const button of await dialog.getByRole("button", { name: "Quitar", exact: true }).all()) {
                    const bounds = await button.evaluate(element => ({ right: element.getBoundingClientRect().right, width: Math.min(window.innerWidth, element.closest("form")!.getBoundingClientRect().right) }));
                    expect(bounds.right).toBeLessThanOrEqual(bounds.width);
                }
            }
            const input = dialog.getByLabel(kind === "create" ? "Concepto" : "Motivo de la corrección", { exact: true });
            await input.fill("QA borrador pendiente");
            await dialog.getByRole("button", { name: "Cancelar", exact: true }).click();
            await expect(page.getByRole("alertdialog")).toBeVisible();
            await page.getByRole("button", { name: "Seguir editando", exact: true }).click();
            await expect(input).toHaveValue("QA borrador pendiente");
            await dialog.getByRole("button", { name: "Cancelar", exact: true }).click();
            await page.getByRole("button", { name: "Salir sin guardar", exact: true }).click();
            await expect(dialog).toHaveCount(0);
            await opener.click();
            await expect(input).toHaveValue("");
            await dialog.getByRole("button", { name: "Cancelar", exact: true }).click();
            await expect(page.getByRole("alertdialog")).toHaveCount(0);
            expect(writes).toBe(0);
        });
    }
}
