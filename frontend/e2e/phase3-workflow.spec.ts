import { expect, test, type Page } from "@playwright/test";

// This suite runs only against the separately seeded local E2E database. It
// exercises the same authenticated UI a company administrator uses without
// depending on development or production records.
test.setTimeout(240_000);

async function login(page: Page) {
    await page.goto("/login");
    await page.locator('input[type="email"]').fill("admin@e2e.example");
    await page.locator('input[type="password"]').fill("e2e-password");
    await page.locator('button[type="submit"]').click();
    await page.waitForURL(/\/dashboard/, { timeout: 30_000 });
}

test("company administrator completes the Phase 3 commercial workflow", async ({ page }) => {
    await login(page);

    const serviceName = "E2E Phase 3 Service";
    await page.goto("/dashboard/tasks");
    await page.getByRole("tab", { name: "Catálogo de servicios" }).click();
    await page.getByRole("button", { name: "Crear Plantilla" }).click();
    await page.locator("#template-name").fill(serviceName);
    await page.locator("#template-price").fill("85");
    await page.locator("#template-duration").fill("90");
    await page.locator("#template-requirements").fill("Llaves y material E2E");
    await page.getByRole("button", { name: "Create service" }).click();
    await expect(page.getByRole("table").getByText(serviceName, { exact: true })).toBeVisible();

    const serviceRow = page.locator("tr", { hasText: serviceName });
    await serviceRow.getByRole("button", { name: "Open actions menu" }).click();
    await page.getByRole("menuitem", { name: "Editar" }).click();
    await page.locator("#template-price").fill("95");
    await page.getByRole("button", { name: "Save changes" }).click();
    await serviceRow.getByRole("button", { name: "Open actions menu" }).click();
    await page.getByRole("menuitem", { name: "Ver historial" }).click();
    await expect(page.getByRole("dialog")).toContainText("Versión 2");
    await page.getByRole("button", { name: "Cerrar" }).click();

    await page.goto("/dashboard/quotes?quote=1");
    await expect(page.getByRole("dialog")).toContainText("E2E Commercial Quote");
    await page.getByRole("button", { name: "Marcar enviado" }).click();
    await expect(page.getByRole("heading", { name: "Gestión de Presupuestos" })).toBeVisible();
    await page.goto("/dashboard/quotes?quote=1");
    await expect(page.getByRole("button", { name: "Crear revisión" })).toBeVisible();
    await page.getByRole("button", { name: "Historial" }).click();
    await expect(page.getByRole("dialog")).toContainText("Versión 1");
    await page.getByRole("button", { name: "Cerrar" }).click();
    await page.getByRole("button", { name: "Crear revisión" }).click();
    await expect(page.getByRole("dialog")).toContainText("Revisión 2");
    await page.locator("#quote-title").fill("E2E Commercial Quote revised");
    await page.getByRole("button", { name: "Guardar revisión" }).click();
    await expect(page.getByRole("heading", { name: "Gestión de Presupuestos" })).toBeVisible();

    await page.goto("/dashboard/quotes?quote=1");
    await expect(page.getByRole("dialog")).toContainText("E2E Commercial Quote revised");
    await page.getByRole("button", { name: "Marcar enviado" }).click();
    await expect(page.getByRole("heading", { name: "Gestión de Presupuestos" })).toBeVisible();
    await page.goto("/dashboard/quotes?quote=1");
    await page.getByRole("button", { name: "Marcar aceptado" }).click();

    await page.goto("/dashboard/contracts?quote=1");
    await expect(page.getByRole("dialog")).toContainText("E2E Commercial Quote revised");
    await page.getByRole("combobox", { name: "Añadir ubicación cubierta" }).click();
    await page.getByRole("option", { name: "E2E Apartment" }).click();
    await page.getByRole("button", { name: "Añadir ubicación" }).click();
    await expect(page.getByRole("dialog")).toContainText("E2E Apartment");
    await page.getByRole("button", { name: "Zonas", exact: true }).click();
    await page.getByText("E2E Kitchen Zone", { exact: true }).click();
    const zonesUpdated = page.waitForResponse((response) => (
        /\/service-contracts\/\d+\/locations\/\d+\/zones$/.test(new URL(response.url()).pathname) && response.request().method() === "PUT"
    ));
    await page.getByRole("button", { name: "Guardar zonas", exact: true }).click();
    expect((await zonesUpdated).status()).toBe(200);
    await expect(page.getByRole("dialog")).toContainText("1 zona seleccionada");
    await page.locator("#contract-response").fill("8");
    await page.locator("#contract-resolution").fill("24");
    await page.locator("#contract-window").fill("Lunes a viernes, 08:00–18:00");
    await page.getByRole("button", { name: "Guardar condiciones" }).click();
    await page.getByRole("button", { name: "Activar contrato" }).click();
    await expect(page.getByRole("dialog")).toContainText("Activo");
});
