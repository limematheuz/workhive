import { expect, test } from "@playwright/test";

for (const width of [1440, 768, 390]) {
    test(`archived material history keeps names and lot at ${width}px`, async ({ context, page }) => {
        test.skip(process.env.E2E_BASE_URL !== "http://localhost:3000", "Local UI regression only");
        await page.setViewportSize({ width, height: 1000 });
        const token = Buffer.from(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600 })).toString("base64url");
        await context.addCookies([{ name: "auth_token", value: `fixture.${token}.not-a-backend-token`, url: "http://localhost:3000" }]);
        await page.addInitScript(() => localStorage.setItem("locale", "es"));
        let writes = 0;
        const movement = { id: 11, material_id: 8, warehouse_id: 9, lot_id: 3, work_order_id: 1, client_id: null, movement_type: "issue", quantity: "3.000", unit_cost: "2.5000", reference: "QA", notes: null, reversal_of_movement_id: null, material_name: "QA material ciclo orden 20261031 archivado", warehouse_name: "QA almacén ciclo orden 20261031 archivado", lot_code: "QA-LOTE-HISTORICO" };
        await page.route("**/api/v1/**", async route => {
            const path = new URL(route.request().url()).pathname.replace(/\/$/, "");
            if (route.request().method() !== "GET") writes++;
            let body: unknown = [];
            if (path === "/api/v1/users/me") body = { id: 1, full_name: "QA", role: { name: "admin" }, company_id: 1, is_active: true, can_view_finance: true };
            else if (path === "/api/v1/companies/1") body = { id: 1, name: "QA", onboarding_completed: true, subscription_status: "active" };
            else if (path.endsWith("organization/access")) body = { "inventory.read": true, "inventory.manage": true, "work.read": true, "work.manage": true };
            else if (path === "/api/v1/work-orders") body = [{ id: 1, title: "QA histórico archivado", location_id: 1, status: "cancelled", order_type: "one_off", scheduled_start_at: "2026-10-31T12:00:00Z", next_occurrence_at: "2026-10-31T12:00:00Z", service_contract_id: null }];
            else if (path === "/api/v1/locations") body = [{ id: 1, name: "QA ubicación", can_manage_tasks: true }];
            else if (path === "/api/v1/work-orders/1/materials") body = [movement, { ...movement, id: 12, movement_type: "adjustment_in", reversal_of_movement_id: 11 }];
            await route.fulfill({ json: body });
        });
        await page.goto("/dashboard/work-orders");
        await page.getByRole("button", { name: "Acciones de QA histórico archivado", exact: true }).filter({ visible: true }).click();
        await page.getByRole("menuitem", { name: "Material", exact: true }).click();
        const dialog = page.getByRole("dialog", { name: "Material consumido", exact: true });
        await expect(dialog.getByText("QA material ciclo orden 20261031 archivado", { exact: true }).filter({ visible: true })).toHaveCount(2);
        await expect(dialog.getByText("QA-LOTE-HISTORICO", { exact: false }).filter({ visible: true })).toHaveCount(2);
        if (width >= 768) await expect(dialog.getByText("QA almacén ciclo orden 20261031 archivado", { exact: true }).filter({ visible: true })).toHaveCount(2);
        for (const label of await dialog.getByText("QA material ciclo orden 20261031 archivado", { exact: true }).filter({ visible: true }).all()) {
            const bounds = await label.evaluate(element => ({ content: element.scrollWidth, available: element.clientWidth }));
            expect(bounds.content).toBeLessThanOrEqual(bounds.available + 1);
        }
        await expect(dialog.getByRole("button", { name: "Registrar", exact: true })).toBeDisabled();
        await expect(dialog.getByRole("button", { name: "Corregir", exact: true })).toHaveCount(0);
        expect(writes).toBe(0);
    });
}
