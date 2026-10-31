import { expect, test } from "@playwright/test";
import { selectSection } from "./helpers/select-section";

for (const width of [390, 768, 1440]) {
    test(`stock rejection preserves the movement draft and retry at ${width}px`, async ({ context, page }) => {
        test.skip(process.env.E2E_BASE_URL !== "http://localhost:3000", "Local UI regression only");
        await page.setViewportSize({ width, height: 900 });
        const token = Buffer.from(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600 })).toString("base64url");
        await context.addCookies([{ name: "auth_token", value: `fixture.${token}.not-a-backend-token`, url: "http://localhost:3000" }]);
        await page.addInitScript(() => localStorage.setItem("locale", "es"));
        const material = { id: 1, name: "QA detergente", sku: "QA-STOCK", unit: "unit", reorder_point: "0", supplier_id: null };
        const warehouse = { id: 2, name: "QA almacén" };
        let requests = 0;
        let available = "6.000";
        let reads = 0;
        let release: () => void = () => {};
        const held = new Promise<void>(resolve => { release = resolve; });
        const payloads: unknown[] = [];
        await page.route("**/api/v1/**", async route => {
            const path = new URL(route.request().url()).pathname.replace(/\/$/, "");
            let body: unknown = [];
            if (path === "/api/v1/users/me") body = { id: 1, full_name: "QA", role: { name: "admin" }, company_id: 1, is_active: true };
            else if (path === "/api/v1/companies/1") body = { id: 1, name: "QA", onboarding_completed: true, subscription_status: "active" };
            else if (path.endsWith("/organization/access")) body = { "inventory.read": true, "inventory.manage": true };
            else if (path.endsWith("/inventory/materials")) body = [material];
            else if (path.endsWith("/inventory/warehouses")) body = [warehouse];
            else if (path.endsWith("/inventory/stock")) {
                reads++;
                body = [{ material_id: 1, material_name: material.name, material_sku: material.sku, warehouse_id: 2, warehouse_name: warehouse.name, unit: "unit", available_quantity: available, reorder_point: "0", is_below_reorder_point: false }];
            } else if (path.endsWith("/inventory/movements") && route.request().method() === "POST") {
                requests++;
                payloads.push(route.request().postDataJSON());
                if (requests === 1) {
                    await held;
                    await route.fulfill({ status: 409, headers: { "X-WorkHive-Error-Code": "inventory.insufficient_stock" }, json: { detail: "No hay stock suficiente para registrar la salida" } });
                    return;
                }
                available = "3.000";
                await route.fulfill({ status: 201, json: { id: 3, ...route.request().postDataJSON() } });
                return;
            }
            await route.fulfill({ json: body });
        });
        await page.goto("/dashboard/inventory");
        await selectSection(page, page, "Movimientos", "Vista: Operativa");
        await expect(page.getByLabel("Lote", { exact: true })).toBeDisabled();
        for (const [label, option] of [["Material", material.name], ["Almacén", warehouse.name], ["Tipo de movimiento", "Salida"]]) {
            await page.getByRole("combobox", { name: label, exact: true }).click();
            await page.getByRole("option", { name: option, exact: true }).click();
        }
        await expect(page.getByLabel("Lote", { exact: true })).toBeEnabled();
        for (const name of ["Material", "Almacén", "Lote", "Tipo de movimiento", "Cantidad", "Referencia"]) {
            const bounds = await page.getByLabel(name, { exact: true }).evaluate(element => {
                const r = element.getBoundingClientRect();
                return { left: r.left, right: r.right, viewport: window.innerWidth };
            });
            expect(bounds.left).toBeGreaterThanOrEqual(0);
            expect(bounds.right).toBeLessThanOrEqual(bounds.viewport);
        }
        await page.getByLabel("Cantidad", { exact: true }).fill("7");
        await page.getByLabel("Referencia", { exact: true }).fill("QA rechazo");
        const readsBefore = reads;
        await page.getByRole("button", { name: "Registrar movimiento", exact: true }).click();
        await expect.poll(() => requests).toBe(1);
        for (const label of ["Material", "Almacén", "Lote", "Tipo de movimiento", "Cantidad", "Referencia"]) {
            await expect(page.getByLabel(label, { exact: true })).toBeDisabled();
        }
        release();
        await expect(page.getByText("No hay stock suficiente para registrar la salida", { exact: true })).toBeVisible();
        await expect(page.getByLabel("Cantidad", { exact: true })).toBeEnabled();
        await expect(page.getByLabel("Cantidad", { exact: true })).toHaveValue("7");
        await expect(page.getByLabel("Referencia", { exact: true })).toHaveValue("QA rechazo");
        expect(reads).toBe(readsBefore);
        await page.getByLabel("Cantidad", { exact: true }).fill("3");
        await page.getByRole("button", { name: "Registrar movimiento", exact: true }).click();
        await expect(page.getByText("Movimiento registrado.", { exact: true })).toBeVisible();
        expect(requests).toBe(2);
        expect(payloads).toEqual(["7", "3"].map(quantity => ({ material_id: 1, warehouse_id: 2, lot_id: null, movement_type: "issue", quantity, unit_cost: null, reference: "QA rechazo", notes: null })));
        await expect(page.getByLabel("Cantidad", { exact: true })).toHaveValue("");
        await expect(page.getByLabel("Referencia", { exact: true })).toHaveValue("");
        await selectSection(page, page, "Stock", "Vista: Operativa");
        await expect(page.getByText("3 unidades", { exact: true }).filter({ visible: true })).toBeVisible();
    });
}
