import { expect, test, type Page } from "@playwright/test";

// Use only with backend/scripts/seed_portal_e2e.py and an isolated E2E URL.
async function login(page: Page) {
    await page.goto("/login");
    await page.locator('input[type="email"]').fill("admin@e2e.example");
    await page.locator('input[type="password"]').fill("e2e-password");
    await page.locator('button[type="submit"]').click();
    await page.waitForURL(/\/dashboard/, { timeout: 30_000 });
}

async function selectLocation(page: Page) {
    await page.getByRole("combobox").first().click();
    await page.getByRole("option", { name: "E2E Apartment", exact: true }).click();
}

test("administrator uploads and archives a private location document", async ({ page }) => {
    test.setTimeout(90_000);
    await login(page);
    await page.goto("/dashboard/documents");
    await selectLocation(page);
    const uploaded = page.waitForResponse((response) => (
        /\/locations\/\d+\/documents$/.test(new URL(response.url()).pathname) && response.request().method() === "POST"
    ));
    await page.getByLabel("Subir documento").setInputFiles({
        name: "E2E-proof.pdf",
        mimeType: "application/pdf",
        buffer: Buffer.from("%PDF-1.4\nE2E location document\n%%EOF"),
    });
    expect((await uploaded).status()).toBe(201);
    const documentRow = page.locator("tr", { hasText: "E2E-proof.pdf" });
    await expect(documentRow.getByText("E2E-proof.pdf", { exact: true })).toBeVisible();
    const archived = page.waitForResponse((response) => (
        /\/locations\/\d+\/documents\/\d+$/.test(new URL(response.url()).pathname) && response.request().method() === "DELETE"
    ));
    await documentRow.getByRole("button", { name: "Archivar E2E-proof.pdf" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Archivar", exact: true }).click();
    expect((await archived).status()).toBe(204);
    await expect(page.getByText("E2E-proof.pdf", { exact: true })).toHaveCount(0);
});

test("administrator adds and archives equipment for a manageable location", async ({ page }) => {
    test.setTimeout(90_000);
    await login(page);
    await page.goto("/dashboard/assets");
    await selectLocation(page);
    await page.getByLabel("Nombre del activo").fill("E2E floor machine");
    await page.getByLabel("Categoría").fill("cleaning");
    const created = page.waitForResponse((response) => (
        /\/locations\/\d+\/equipment$/.test(new URL(response.url()).pathname) && response.request().method() === "POST"
    ));
    await page.getByRole("button", { name: "Añadir", exact: true }).click();
    expect((await created).status()).toBe(201);
    const equipmentRow = page.locator("tr", { hasText: "E2E floor machine" });
    await expect(equipmentRow.getByText("E2E floor machine", { exact: true })).toBeVisible();
    const archived = page.waitForResponse((response) => (
        /\/locations\/\d+\/equipment\/\d+$/.test(new URL(response.url()).pathname) && response.request().method() === "DELETE"
    ));
    await equipmentRow.getByRole("button", { name: "Archivar E2E floor machine" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Archivar", exact: true }).click();
    expect((await archived).status()).toBe(204);
    await expect(page.getByText("E2E floor machine", { exact: true })).toHaveCount(0);
});
