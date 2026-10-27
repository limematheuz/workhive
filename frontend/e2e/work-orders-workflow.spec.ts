import { expect, test, type Page } from "@playwright/test";

test.use({ timezoneId: "UTC" });

// Use only with backend/scripts/seed_portal_e2e.py and an isolated E2E URL.
async function login(page: Page) {
    await page.goto("/login");
    await page.locator('input[type="email"]').fill("admin@e2e.example");
    await page.locator('input[type="password"]').fill("e2e-password");
    await page.locator('button[type="submit"]').click();
    await page.waitForURL(/\/dashboard/, { timeout: 30_000 });
}

test("administrator plans, pauses, replans and generates a one-off work order", async ({ page }) => {
    test.setTimeout(90_000);
    await login(page);
    await page.goto("/dashboard/work-orders");
    await page.getByRole("button", { name: "Nueva orden" }).click();
    await page.locator("#work-order-title").fill("E2E operational order");
    await page.locator("#work-order-location").click();
    await page.getByRole("option", { name: "E2E Apartment", exact: true }).click();
    const firstDay = new Date().toISOString().slice(0, 10);
    await page.getByRole("button", { name: "Abrir calendario", exact: true }).click();
    await page.locator(`[data-day="${firstDay}"]`).click();
    await page.locator("#work-order-scheduled-time").click();
    await page.getByRole("option", { name: "09:00", exact: true }).click();

    const created = page.waitForResponse((response) => (
        response.url().endsWith("/work-orders/") && response.request().method() === "POST"
    ));
    await page.getByRole("button", { name: "Crear orden" }).click();
    expect((await created).status()).toBe(201);
    const originalRow = page.locator("tr", { hasText: "E2E operational order" });
    await expect(originalRow).toBeVisible();

    await originalRow.getByRole("button", { name: /Acciones de/ }).click();
    await page.getByRole("menuitem", { name: "Editar", exact: true }).click();
    await page.locator("#work-order-edit-title").fill("E2E rescheduled order");
    const nextDay = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
    await page.getByRole("button", { name: "Abrir calendario", exact: true }).click();
    await page.locator(`[data-day="${nextDay}"]`).click();
    await page.locator("#work-order-edit-scheduled-time").click();
    await page.getByRole("option", { name: "10:30", exact: true }).click();
    await page.locator("#work-order-edit-status").click();
    await page.getByRole("option", { name: "Pausada", exact: true }).click();
    const paused = page.waitForResponse((response) => (
        /\/work-orders\/\d+$/.test(new URL(response.url()).pathname) && response.request().method() === "PATCH"
    ));
    await page.getByRole("button", { name: "Guardar cambios" }).click();
    expect((await paused).status()).toBe(200);
    const rescheduledRow = page.locator("tr", { hasText: "E2E rescheduled order" });
    await expect(rescheduledRow.getByText("Pausada", { exact: true })).toBeVisible();
    await expect(rescheduledRow.getByRole("button", { name: /Generar/ })).toHaveCount(0);

    await rescheduledRow.getByRole("button", { name: /Acciones de/ }).click();
    await page.getByRole("menuitem", { name: "Editar", exact: true }).click();
    await page.locator("#work-order-edit-status").click();
    await page.getByRole("option", { name: "Activa", exact: true }).click();
    const reactivated = page.waitForResponse((response) => (
        /\/work-orders\/\d+$/.test(new URL(response.url()).pathname) && response.request().method() === "PATCH"
    ));
    await page.getByRole("button", { name: "Guardar cambios" }).click();
    expect((await reactivated).status()).toBe(200);

    const generated = page.waitForResponse((response) => (
        /\/work-orders\/\d+\/generate$/.test(new URL(response.url()).pathname) && response.request().method() === "POST"
    ));
    await rescheduledRow.getByRole("button", { name: /Acciones de/ }).click();
    await page.getByRole("menuitem", { name: "Generar tarea", exact: true }).click();
    expect((await generated).status()).toBe(200);
    await expect(rescheduledRow.getByText("Finalizada", { exact: true })).toBeVisible();
});
