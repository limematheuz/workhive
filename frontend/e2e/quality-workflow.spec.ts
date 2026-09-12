import { expect, test, type Page } from "@playwright/test";

// Use only with backend/scripts/seed_portal_e2e.py and an isolated E2E URL.
async function login(page: Page) {
    await page.goto("/login");
    await page.locator('input[type="email"]').fill("admin@e2e.example");
    await page.locator('input[type="password"]').fill("e2e-password");
    await page.locator('button[type="submit"]').click();
    await page.waitForURL(/\/dashboard/, { timeout: 30_000 });
}

test("administrator creates, scores and closes a quality inspection, then registers an incident", async ({ page }) => {
    test.setTimeout(90_000);
    await login(page);
    await page.goto("/dashboard/quality");
    await page.getByRole("button", { name: "Nueva plantilla" }).click();
    await page.locator("#quality-template-title").fill("E2E quality departure");
    await page.getByPlaceholder("Punto 1").fill("Revisar cocina");
    const templateCreated = page.waitForResponse((response) => (
        response.url().endsWith("/quality/templates/") && response.request().method() === "POST"
    ));
    await page.getByRole("button", { name: "Guardar plantilla" }).click();
    expect((await templateCreated).status()).toBe(201);
    await expect(page.getByRole("table").getByText("E2E quality departure", { exact: true })).toBeVisible();

    await page.getByRole("tab", { name: "Inspecciones" }).click();
    await page.getByRole("button", { name: "Nueva inspección" }).click();
    const inspectionDialog = page.getByRole("dialog");
    await inspectionDialog.getByRole("combobox").nth(0).click();
    await page.getByRole("option", { name: "E2E quality departure", exact: true }).click();
    await inspectionDialog.getByRole("combobox").nth(1).click();
    await page.getByRole("option", { name: "E2E Apartment", exact: true }).click();
    const inspectionCreated = page.waitForResponse((response) => (
        response.url().endsWith("/quality/inspections/") && response.request().method() === "POST"
    ));
    await inspectionDialog.getByRole("button", { name: "Iniciar inspección" }).click();
    expect((await inspectionCreated).status()).toBe(201);

    const inspectionRow = page.locator("tr", { hasText: "E2E quality departure" });
    await inspectionRow.click();
    const reviewDialog = page.getByRole("dialog");
    await reviewDialog.getByRole("combobox").click();
    await page.getByRole("option", { name: "Correcto", exact: true }).click();
    const completed = page.waitForResponse((response) => (
        /\/quality\/inspections\/\d+\/complete$/.test(new URL(response.url()).pathname) && response.request().method() === "POST"
    ));
    await reviewDialog.getByRole("button", { name: "Cerrar inspección" }).click();
    expect((await completed).status()).toBe(200);
    await expect(inspectionRow.getByText("Cerrada", { exact: true })).toBeVisible();

    await page.getByRole("tab", { name: "Incidencias" }).click();
    await page.getByRole("button", { name: "Nueva incidencia" }).click();
    const incidentDialog = page.getByRole("dialog");
    await incidentDialog.getByRole("combobox").nth(0).click();
    await page.getByRole("option", { name: "E2E Apartment", exact: true }).click();
    await page.locator("#quality-incident-title").fill("E2E quality incident");
    const incidentCreated = page.waitForResponse((response) => (
        response.url().endsWith("/quality/incidents/") && response.request().method() === "POST"
    ));
    await incidentDialog.getByRole("button", { name: "Registrar incidencia" }).click();
    expect((await incidentCreated).status()).toBe(201);
    const incidentRow = page.locator("tr", { hasText: "E2E quality incident" });
    await expect(incidentRow.getByText("E2E quality incident", { exact: true })).toBeVisible();
    await incidentRow.click();
    const actionsDialog = page.getByRole("dialog");
    await actionsDialog.locator("#quality-corrective-action-title").fill("E2E replenish supplies");
    await actionsDialog.locator("#quality-corrective-action-due").fill("2026-12-15");
    const actionCreated = page.waitForResponse((response) => (
        /\/quality\/incidents\/\d+\/actions$/.test(new URL(response.url()).pathname) && response.request().method() === "POST"
    ));
    await actionsDialog.getByRole("button", { name: "Añadir acción" }).click();
    expect((await actionCreated).status()).toBe(201);
    await expect(actionsDialog.getByText("E2E replenish supplies", { exact: true })).toBeVisible();

    const actionCompleted = page.waitForResponse((response) => (
        /\/quality\/incidents\/\d+\/actions\/\d+$/.test(new URL(response.url()).pathname) && response.request().method() === "PATCH"
    ));
    await actionsDialog.getByRole("button", { name: "Completar" }).click();
    expect((await actionCompleted).status()).toBe(200);
    await expect(actionsDialog.getByText("Completada", { exact: true })).toBeVisible();

});
