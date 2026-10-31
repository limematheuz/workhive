import { expect, test } from "@playwright/test";
import { selectSection } from "./helpers/select-section";

for (const width of [390, 768, 1440]) {
    for (const archived of ["material", "warehouse"] as const) {
        test(`archiving selected ${archived} invalidates only its movement selection at ${width}px`, async ({ context, page }) => {
            test.skip(process.env.E2E_BASE_URL !== "http://localhost:3000", "Local UI regression only");
            await page.setViewportSize({ width, height: 900 });
            const token = Buffer.from(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600 })).toString("base64url");
            await context.addCookies([{ name: "auth_token", value: `fixture.${token}.not-a-backend-token`, url: "http://localhost:3000" }]);
            await page.addInitScript(() => localStorage.setItem("locale", "es"));
            let materials = [{ id: 1, name: "QA material inicial", sku: "QA-1", unit: "unit", reorder_point: "0" }, { id: 4, name: "QA material alternativo", sku: "QA-4", unit: "unit", reorder_point: "0" }];
            let warehouses = [{ id: 2, name: "QA almacén inicial" }, { id: 5, name: "QA almacén alternativo" }];
            const writes: unknown[] = [];
            await page.route("**/api/v1/**", async route => {
                const path = new URL(route.request().url()).pathname.replace(/\/$/, "");
                let body: unknown = [];
                if (path === "/api/v1/users/me") body = { id: 1, full_name: "QA", role: { name: "admin" }, company_id: 1, is_active: true };
                else if (path === "/api/v1/companies/1") body = { id: 1, name: "QA", onboarding_completed: true, subscription_status: "active" };
                else if (path.endsWith("/organization/access")) body = { "inventory.read": true, "inventory.manage": true };
                else if (route.request().method() === "DELETE") {
                    expect(path).toBe(`/api/v1/inventory/${archived === "material" ? "materials/1" : "warehouses/2"}`);
                    if (archived === "material") materials = materials.filter(item => item.id !== 1);
                    else warehouses = warehouses.filter(item => item.id !== 2);
                    await route.fulfill({ status: 204 });
                    return;
                } else if (path.endsWith("/inventory/materials")) body = materials;
                else if (path.endsWith("/inventory/warehouses")) body = warehouses;
                else if (path.endsWith("/inventory/lots")) body = [{ id: 3, material_id: 1, warehouse_id: 2, code: "QA lote inicial", available_quantity: "0.000" }];
                else if (path.endsWith("/inventory/movements") && route.request().method() === "POST") {
                    writes.push(route.request().postDataJSON());
                    await route.fulfill({ status: 201, json: { id: 10, ...route.request().postDataJSON() } });
                    return;
                }
                await route.fulfill({ json: body });
            });
            await page.goto("/dashboard/inventory");
            await selectSection(page, page, "Movimientos", "Vista: Operativa");
            for (const [label, option] of [["Material", "QA material inicial"], ["Almacén", "QA almacén inicial"], ["Lote", "QA lote inicial"]]) {
                await page.getByRole("combobox", { name: label, exact: true }).click();
                await page.getByRole("option", { name: option, exact: true }).click();
            }
            await page.getByLabel("Cantidad", { exact: true }).fill("5");
            await page.getByLabel("Referencia", { exact: true }).fill("QA borrador conservado");
            await selectSection(page, page, "Catálogo", "Área de inventario");
            await selectSection(page, page, archived === "material" ? "Materiales" : "Almacenes", "Vista: Catálogo");
            await page.getByRole("button", { name: `Archivar QA ${archived === "material" ? "material" : "almacén"} inicial`, exact: true }).filter({ visible: true }).click();
            await page.getByRole("dialog", { name: "Archivar registro de inventario", exact: true }).getByRole("button", { name: "Archivar", exact: true }).click();
            await expect(page.getByRole("dialog", { name: "Archivar registro de inventario", exact: true })).toHaveCount(0);
            await selectSection(page, page, "Operativa", "Área de inventario");
            const invalid = page.getByRole("combobox", { name: archived === "material" ? "Material" : "Almacén", exact: true });
            await expect(invalid).toHaveText(archived === "material" ? "Material" : "Almacén");
            await expect(page.getByLabel(archived === "material" ? "Almacén" : "Material", { exact: true })).toContainText(archived === "material" ? "QA almacén inicial" : "QA material inicial");
            await expect(page.getByLabel("Lote", { exact: true })).toBeDisabled();
            await expect(page.getByLabel("Lote", { exact: true })).toHaveText("Sin lote");
            await expect(page.getByLabel("Cantidad", { exact: true })).toHaveValue("5");
            await expect(page.getByLabel("Referencia", { exact: true })).toHaveValue("QA borrador conservado");
            await expect(page.getByRole("button", { name: "Registrar movimiento", exact: true })).toBeDisabled();
            expect(writes).toEqual([]);
            await invalid.click();
            await page.getByRole("option", { name: archived === "material" ? "QA material alternativo" : "QA almacén alternativo", exact: true }).click();
            await page.getByRole("button", { name: "Registrar movimiento", exact: true }).click();
            await expect(page.getByText("Movimiento registrado.", { exact: true })).toBeVisible();
            expect(writes).toEqual([{ material_id: archived === "material" ? 4 : 1, warehouse_id: archived === "warehouse" ? 5 : 2, lot_id: null, movement_type: "receipt", quantity: "5", unit_cost: null, reference: "QA borrador conservado", notes: null }]);
        });
    }
}
