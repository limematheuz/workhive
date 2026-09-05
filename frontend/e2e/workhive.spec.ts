import { expect, Page, test } from "@playwright/test";


async function login(page: Page, email: string) {
    await page.goto("/login");
    await page.locator('input[type="email"]').fill(email);
    await page.locator('input[type="password"]').fill("e2e-password");
    await page.locator('button[type="submit"]').click();
    await page.waitForURL(/\/dashboard/, { timeout: 15_000 });
}


test("superadmin can sign in and inspect companies", async ({ page }) => {
    await login(page, "superadmin@e2e.example");
    await page.goto("/dashboard/companies");

    await expect(page.getByRole("heading", { name: /empresas|companies/i })).toBeVisible();
    await expect(page.getByRole("button", { name: "E2E Services" })).toBeVisible();
});


test("company workflow exposes locations, reservations, tasks, quotes, and invoices", async ({
    page,
}) => {
    await login(page, "admin@e2e.example");

    await page.goto("/dashboard/locations");
    await expect(
        page.getByRole("button", { name: /Ver detalle de E2E Apartment/ })
    ).toBeVisible();

    await page.goto("/dashboard/reservations");
    await expect(page.getByRole("heading", { name: "E2E Apartment" })).toBeVisible();

    await page.goto("/dashboard/tasks");
    await expect(
        page.getByRole("button", { name: "Abrir tarea: E2E Cleaning Task" })
    ).toBeVisible();

    await page.goto("/dashboard/quotes/1");
    await expect(
        page.getByRole("heading", { name: /QUO-E2E-QUO-001/ }).first()
    ).toBeVisible();

    await page.goto("/dashboard/invoices");
    await expect(
        page.getByRole("button", { name: "Abrir factura INV-2026-0001" })
    ).toBeVisible();

    await page.goto("/dashboard/invoices/1");
    await expect(
        page.getByRole("heading", { name: /INV-\d{4}-0001/ }).first()
    ).toBeVisible();
    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: /Descargar PDF definitivo/i }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/^INV-\d{4}-0001\.pdf$/);
    expect(await download.failure()).toBeNull();
});

test("commercial profile can work with clients without seeing financial routes", async ({ page }) => {
    test.setTimeout(120_000);
    await login(page, "commercial@e2e.example");

    await page.goto("/dashboard/clients");
    await expect(page.getByRole("heading", { name: /clientes/i }).first()).toBeVisible();

    for (const route of [
        "/dashboard/quotes",
        "/dashboard/invoices",
        "/dashboard/expenses",
        "/dashboard/invoice-summary",
        "/dashboard/fiscal-calendar",
        "/dashboard/analytics",
        "/dashboard/fiscal-summary",
    ]) {
        await page.goto(route);
        await expect(page).toHaveURL(/\/dashboard\/?$/, { timeout: 15_000 });
    }
});
