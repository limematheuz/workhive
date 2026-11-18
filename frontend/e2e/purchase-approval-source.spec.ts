import { expect, test, type Page } from "@playwright/test";

const localBase = process.env.E2E_BASE_URL ?? "";
test.beforeEach(async ({ context, page }) => {
    test.skip(!/^http:\/\/(?:localhost|127\.0\.0\.1):(?:3000|3013)$/.test(localBase), "Intercepted local preview regression only");
    const token = Buffer.from(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600 })).toString("base64url");
    await context.addCookies([{ name: "auth_token", value: `fixture.${token}.not-a-backend-token`, url: localBase }]);
    await page.addInitScript(() => localStorage.setItem("locale", "es"));
    page.on("pageerror", error => console.error("Purchase fixture page error:", error.message));
});
async function fixtures(page: Page, { financeManage = true, available = true, required = false } = {}) {
    const writes: Array<{ path: string; body: Record<string, unknown> }> = [];
    const proposal = { id: 31, status: "pending", fingerprint: "a".repeat(64), purchase_id: null, note: "", created_at: "2026-11-17T12:00:00Z", source_request: { id: 17, description: "Consumibles autorizados", amount: "15", status: "approved" }, purchase: { supplier_id: 1, description: "Consumibles autorizados", tax_amount: "2.1", expense_date: "2026-11-17T12:00:00", category: "supplies", lines: [{ material_id: 2, warehouse_id: 3, quantity: "2", unit_cost: "5" }] } };
    await page.route("**/api/v1/**", async route => {
        const path = new URL(route.request().url()).pathname.replace(/\/$/, ""), method = route.request().method();
        if (path === "/api/v1/traffic/page-view") { await route.fulfill({ status: 204 }); return; }
        if (method !== "GET") writes.push({ path, body: route.request().postDataJSON() });
        let body: unknown = [];
        if (path === "/api/v1/users/me") body = { id: 1, full_name: "QA comprador", role: { name: financeManage ? "admin" : "manager" }, company_id: 1, is_active: true, can_view_finance: true, can_manage_finance: financeManage };
        else if (path === "/api/v1/companies/1") body = { id: 1, name: "QA", onboarding_completed: true, subscription_status: "active" };
        else if (path === "/api/v1/session/companies") body = { current_company_id: 1, companies: [{ id: 1, name: "QA", access_class: financeManage ? "admin" : "responsible", disabled: false, disabled_reason: null }] };
        else if (path.endsWith("organization/access")) body = { "inventory.read": true, "inventory.manage": true, "finance.read": true, "finance.manage": financeManage };
        else if (path.endsWith("companies/current/entitlements")) body = { entitlements: ["features.inventory", "features.hr"].map(code => ({ code, value: true, value_type: "boolean" })) };
        else if (path.endsWith("/inventory/suppliers")) body = [{ id: 1, name: "Suministros Costa" }];
        else if (path.endsWith("/inventory/materials")) body = [{ id: 2, name: "Detergente neutro", sku: "DET-2", unit: "liter", reorder_point: "0" }];
        else if (path.endsWith("/inventory/warehouses")) body = [{ id: 3, name: "Almacén central" }];
        else if (path.endsWith("/workflow-approvals/policy")) body = { available, purchases_required: required, task_close_required: false, can_manage: financeManage };
        else if (path.endsWith("/workflow-approvals/source-requests")) body = [{ id: 17, description: "Consumibles autorizados", amount: "15" }];
        else if (path.endsWith("/workflow-approvals/purchases")) body = method === "GET" ? [] : proposal;
        else if (path.endsWith("/internal-requests/access")) body = { kinds: ["material", "purchase"], can_review: false };
        else if (path.endsWith("/internal-requests/choices")) body = [{ id: 1, name: "Ana Prueba" }];
        await route.fulfill({ json: body });
    });
    return writes;
}
async function fillRealLines(page: Page) {
    const dialog = page.getByRole("dialog", { name: "Nueva compra de material", exact: true });
    await dialog.getByRole("combobox", { name: "Proveedor de la compra" }).click();
    await page.getByRole("option", { name: "Suministros Costa", exact: true }).click();
    await dialog.getByRole("combobox", { name: "Material 1", exact: true }).click();
    await page.getByRole("option", { name: "Detergente neutro", exact: true }).click();
    await dialog.getByRole("combobox", { name: "Almacén 1", exact: true }).click();
    await page.getByRole("option", { name: "Almacén central", exact: true }).click();
    await dialog.getByRole("spinbutton", { name: "Cantidad 1", exact: true }).fill("2");
    await dialog.getByRole("spinbutton", { name: "Coste unitario 1", exact: true }).fill("5");
    await dialog.getByLabel("IVA soportado", { exact: true }).fill("2.10");
    return dialog;
}
test("approved request link opens the purchase form and sends its real lines for approval", async ({ page }) => {
    const writes = await fixtures(page);
    await page.goto("/dashboard/inventory?request_id=17", { waitUntil: "domcontentloaded" });
    const dialog = page.getByRole("dialog", { name: "Nueva compra de material", exact: true });
    await expect(dialog.getByLabel("Concepto", { exact: true })).toHaveValue("Consumibles autorizados");
    await expect(dialog.getByText("Máximo autorizado:", { exact: false })).toBeVisible();
    await expect(dialog.getByRole("combobox", { name: "Proveedor de la compra" })).toHaveText("Selecciona proveedor");
    await fillRealLines(page);
    await dialog.getByRole("button", { name: "Enviar a aprobación", exact: true }).click();
    await expect.poll(() => writes.length).toBe(1);
    expect(writes[0].path).toBe("/api/v1/workflow-approvals/purchases");
    expect(writes[0].body).toMatchObject({ source_request_id: 17, purchase: { supplier_id: 1, description: "Consumibles autorizados", tax_amount: "2.10", lines: [{ material_id: 2, warehouse_id: 3, quantity: "2", unit_cost: "5" }] } });
});
test("supervisor with finance read proposes instead of registering stock directly", async ({ page }) => {
    const writes = await fixtures(page, { financeManage: false });
    await page.goto("/dashboard/inventory?tab=purchases", { waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: "Nueva compra", exact: true }).click();
    const dialog = await fillRealLines(page);
    await dialog.getByLabel("Concepto", { exact: true }).fill("Material solicitado");
    await dialog.getByRole("button", { name: "Enviar a aprobación", exact: true }).click();
    await expect.poll(() => writes.length).toBe(1);
    expect(writes[0].path).toBe("/api/v1/workflow-approvals/purchases");
    expect(writes[0].body).not.toHaveProperty("source_request_id");
    await expect(page.getByRole("button", { name: "Aprobar y registrar", exact: true })).toHaveCount(0);
});
test("required approval unavailable in the plan blocks new purchase registration", async ({ page }) => {
    const writes = await fixtures(page, { available: false, required: true });
    await page.goto("/dashboard/inventory?tab=purchases", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("button", { name: "Nueva compra", exact: true })).toBeDisabled();
    await expect(page.getByText("Se necesita aprobación para registrar esta compra", { exact: false })).toBeVisible();
    expect(writes).toEqual([]);
});
test("inventory-only requests choose an enabled kind and hide unauthorized review actions", async ({ page }) => {
    const writes = await fixtures(page);
    await page.goto("/dashboard/plantilla/solicitudes", { waitUntil: "domcontentloaded" });
    const kind = page.getByRole("combobox", { name: "Tipo de solicitud", exact: true });
    await expect(kind).toContainText("Material");
    await kind.click();
    await expect(page.getByRole("option")).toHaveCount(2);
    await expect(page.getByRole("option", { name: "Vacaciones", exact: true })).toHaveCount(0);
    await expect(page.getByRole("checkbox", { name: "Solicitudes para revisar", exact: true })).toHaveCount(0);
    expect(writes).toEqual([]);
});
