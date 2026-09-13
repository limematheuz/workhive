import { expect, test, type Page } from "@playwright/test";

// Use only with backend/scripts/seed_portal_e2e.py and an isolated E2E URL.
async function login(page: Page) {
    await page.goto("/login");
    await page.locator('input[type="email"]').fill("admin@e2e.example");
    await page.locator('input[type="password"]').fill("e2e-password");
    await page.locator('button[type="submit"]').click();
    await page.waitForURL(/\/dashboard/, { timeout: 30_000 });
}

test("administrator creates inventory data and sees the calculated warehouse balance", async ({ page }) => {
    test.setTimeout(90_000);
    await login(page);
    await page.goto("/dashboard/inventory");
    await expect(page.getByRole("heading", { name: "Inventario" })).toBeVisible();

    await page.getByRole("tab", { name: "Proveedores" }).click();
    await page.getByLabel("Nombre del proveedor").fill("E2E Supplies");
    const supplierCreated = page.waitForResponse((response) => (
        response.url().endsWith("/inventory/suppliers") && response.request().method() === "POST"
    ));
    await page.getByRole("button", { name: "Añadir proveedor" }).click();
    expect((await supplierCreated).status()).toBe(201);
    await expect(page.getByText("E2E Supplies", { exact: true })).toBeVisible();

    await page.getByRole("tab", { name: "Materiales" }).click();
    await page.getByLabel("SKU").fill("E2E-DET-001");
    await page.getByLabel("Nombre del material").fill("E2E detergent");
    const materialCreated = page.waitForResponse((response) => (
        response.url().endsWith("/inventory/materials") && response.request().method() === "POST"
    ));
    await page.getByRole("button", { name: "Añadir material" }).click();
    expect((await materialCreated).status()).toBe(201);
    await expect(page.getByText("E2E detergent", { exact: true })).toBeVisible();

    await page.getByRole("tab", { name: "Almacenes" }).click();
    await page.getByLabel("Nombre del almacén").fill("E2E central warehouse");
    const warehouseCreated = page.waitForResponse((response) => (
        response.url().endsWith("/inventory/warehouses") && response.request().method() === "POST"
    ));
    await page.getByRole("button", { name: "Añadir almacén" }).click();
    expect((await warehouseCreated).status()).toBe(201);

    await page.getByRole("tab", { name: "Movimientos" }).click();
    await page.getByLabel("Material").click();
    await page.getByRole("option", { name: "E2E detergent", exact: true }).click();
    await page.getByLabel("Almacén").click();
    await page.getByRole("option", { name: "E2E central warehouse", exact: true }).click();
    await page.getByLabel("Cantidad").fill("9");
    const receiptCreated = page.waitForResponse((response) => (
        response.url().endsWith("/inventory/movements") && response.request().method() === "POST"
    ));
    await page.getByRole("button", { name: "Registrar movimiento" }).click();
    expect((await receiptCreated).status()).toBe(201);

    await page.getByLabel("Tipo de movimiento").click();
    await page.getByRole("option", { name: "Salida", exact: true }).click();
    await page.getByLabel("Cantidad").fill("3");
    const issueCreated = page.waitForResponse((response) => (
        response.url().endsWith("/inventory/movements") && response.request().method() === "POST"
    ));
    await page.getByRole("button", { name: "Registrar movimiento" }).click();
    expect((await issueCreated).status()).toBe(201);

    await page.getByRole("tab", { name: "Stock" }).click();
    const stockRow = page.locator("tr", { hasText: "E2E detergent" });
    await expect(stockRow.getByText("6", { exact: true })).toBeVisible();
});
