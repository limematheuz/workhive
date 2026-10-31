import { expect, test, type Page } from "@playwright/test";
import { selectSection } from "./helpers/select-section";

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

    await selectSection(page, page, "Catálogo", "Área de inventario");
    await selectSection(page, page, "Proveedores", "Vista: Catálogo");
    await page.getByLabel("Nombre del proveedor").fill("E2E Supplies");
    const supplierCreated = page.waitForResponse((response) => (
        response.url().endsWith("/inventory/suppliers") && response.request().method() === "POST"
    ));
    await page.getByRole("button", { name: "Añadir proveedor" }).click();
    expect((await supplierCreated).status()).toBe(201);
    await expect(page.getByRole("row", { name: /E2E Supplies/ })).toBeVisible();

    await selectSection(page, page, "Materiales", "Vista: Catálogo");
    await page.getByLabel("SKU").fill("E2E-DET-001");
    await page.getByLabel("Nombre del material").fill("E2E detergent");
    const materialCreated = page.waitForResponse((response) => (
        response.url().endsWith("/inventory/materials") && response.request().method() === "POST"
    ));
    await page.getByRole("button", { name: "Añadir material" }).click();
    expect((await materialCreated).status()).toBe(201);
    await expect(page.getByRole("row", { name: /E2E detergent/ })).toBeVisible();

    await selectSection(page, page, "Almacenes", "Vista: Catálogo");
    await page.getByLabel("Nombre del almacén").fill("E2E central warehouse");
    const warehouseCreated = page.waitForResponse((response) => (
        response.url().endsWith("/inventory/warehouses") && response.request().method() === "POST"
    ));
    await page.getByRole("button", { name: "Añadir almacén" }).click();
    expect((await warehouseCreated).status()).toBe(201);

    await selectSection(page, page, "Operativa", "Área de inventario");
    await selectSection(page, page, "Movimientos", "Vista: Operativa");
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

    await selectSection(page, page, "Stock", "Vista: Operativa");
    const stockRow = page.locator("tr", { hasText: "E2E detergent" });
    await expect(stockRow).toContainText("6 unidades");
});
