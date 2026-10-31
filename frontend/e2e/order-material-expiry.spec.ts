import { expect, test } from "@playwright/test";

for (const width of [1440, 768, 390]) {
    test(`order material expiry blocks expired lots and preserves draft at ${width}px`, async ({ context, page }) => {
        test.skip(process.env.E2E_BASE_URL !== "http://localhost:3000", "Local UI regression only");
        await page.setViewportSize({ width, height: 1000 });
        const token = Buffer.from(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600 })).toString("base64url");
        await context.addCookies([{ name: "auth_token", value: `fixture.${token}.not-a-backend-token`, url: "http://localhost:3000" }]);
        await page.addInitScript(() => localStorage.setItem("locale", "es"));
        const writes: unknown[] = [];
        await page.route("**/api/v1/**", async route => {
            const path = new URL(route.request().url()).pathname.replace(/\/$/, "");
            let body: unknown = [];
            if (path === "/api/v1/users/me") body = { id: 1, full_name: "QA", role: { name: "admin" }, company_id: 1, is_active: true };
            else if (path === "/api/v1/companies/1") body = { id: 1, name: "QA", onboarding_completed: true, subscription_status: "active" };
            else if (path.endsWith("organization/access")) body = { "inventory.read": true, "inventory.manage": true, "work.read": true, "work.manage": true };
            else if (path === "/api/v1/work-orders") body = [{ id: 1, title: "QA caducidad", location_id: 1, status: "active", order_type: "one_off", scheduled_start_at: "2026-10-31T12:00:00Z", service_contract_id: null }];
            else if (path === "/api/v1/locations") body = [{ id: 1, name: "QA ubicación", can_manage_tasks: true }];
            else if (path === "/api/v1/inventory/materials") body = [{ id: 1, name: "QA material" }];
            else if (path === "/api/v1/inventory/warehouses") body = [{ id: 1, name: "QA almacén" }];
            else if (path === "/api/v1/inventory/lots") body = [
                { id: 1, material_id: 1, warehouse_id: 1, code: "QA-VENCIDO", available_quantity: "2", expiry_status: "expired" },
                { id: 2, material_id: 1, warehouse_id: 1, code: "QA-VIGENTE", available_quantity: "2", expiry_status: "expiring" },
            ];
            else if (path === "/api/v1/work-orders/1/materials" && route.request().method() === "POST") {
                writes.push(route.request().postDataJSON());
                body = { id: 10 };
            }
            await route.fulfill({ json: body });
        });
        await page.goto("/dashboard/work-orders");
        await page.getByRole("button", { name: "Acciones de QA caducidad", exact: true }).filter({ visible: true }).click();
        await page.getByRole("menuitem", { name: "Material", exact: true }).click();
        const dialog = page.getByRole("dialog", { name: "Material consumido", exact: true });
        await dialog.getByRole("combobox", { name: "Material consumido", exact: true }).click();
        await page.getByRole("option", { name: "QA material", exact: true }).click();
        await dialog.getByRole("combobox", { name: "Almacén de salida", exact: true }).click();
        await page.getByRole("option", { name: "QA almacén", exact: true }).click();
        await dialog.getByRole("combobox", { name: "Lote consumido", exact: true }).click();
        await page.getByRole("option", { name: /QA-VENCIDO/ }).click();
        await dialog.getByRole("spinbutton", { name: "Cantidad consumida", exact: true }).fill("1");
        await dialog.getByLabel("Nota interna", { exact: true }).fill("QA conservar borrador");
        await expect(dialog.getByText("Lote caducado: selecciona otro lote para registrar el consumo.", { exact: true })).toBeVisible();
        await expect(dialog.getByRole("button", { name: "Registrar", exact: true })).toBeDisabled();
        expect(writes).toEqual([]);
        await dialog.getByRole("combobox", { name: "Lote consumido", exact: true }).click();
        await page.getByRole("option", { name: /QA-VIGENTE/ }).click();
        await expect(dialog.getByText("Este lote caduca en 30 días o menos.", { exact: true })).toBeVisible();
        await expect(dialog.getByRole("spinbutton", { name: "Cantidad consumida", exact: true })).toHaveValue("1");
        await expect(dialog.getByLabel("Nota interna", { exact: true })).toHaveValue("QA conservar borrador");
        await dialog.getByRole("button", { name: "Registrar", exact: true }).click();
        await expect.poll(() => writes.length).toBe(1);
        expect(writes[0]).toEqual({ material_id: 1, warehouse_id: 1, lot_id: 2, quantity: "1", notes: "QA conservar borrador" });
    });
}
