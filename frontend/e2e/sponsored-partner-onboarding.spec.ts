import { expect, test } from "@playwright/test";

// The token and code exist only in backend/scripts/seed_portal_e2e.py, which
// rejects every database other than the separately named E2E SQLite fixture.
const invitationToken = "e2e-sponsored-partner-acceptance-token-2026";
const invitationCode = "E2EACCEPT01";
const portalPassword = `e2e-${Date.now()}-Aa1!`;

test("sponsored property manager accepts an invitation and enters its restricted portal", async ({ page }) => {
    test.setTimeout(90_000);

    await page.goto(`/accept-sponsored-partner-invitation#token=${invitationToken}`);
    await expect(page.getByRole("heading", { name: "Crea tu acceso limitado" })).toBeVisible();
    await page.locator("#portal-invite-code").fill(invitationCode);
    await page.locator("#portal-company-name").fill("E2E Sponsored Manager");
    await page.locator("#portal-tax-id").fill("E2E-SPONSORED-ACCEPT");
    await page.locator("#portal-address").fill("Calle E2E 99");
    await page.locator("#portal-postal-code").fill("28001");
    await page.locator("#portal-city").fill("Madrid");
    await page.locator("#portal-province").fill("Madrid");
    await page.locator("#portal-phone").fill("600000099");
    await page.locator("#portal-full-name").fill("E2E Sponsored User");
    await page.locator("#sponsored-partner-password").fill(portalPassword);
    await page.locator("#sponsored-partner-confirm-password").fill(portalPassword);
    await page.locator("#sponsored-partner-legal").check();

    const accepted = page.waitForResponse((response) => (
        response.url().endsWith("/collaborations/sponsored-invitations/accept")
        && response.request().method() === "POST"
    ));
    await page.getByRole("button", { name: "Crear portal" }).click();
    expect((await accepted).status()).toBe(200);
    await expect(page.getByRole("heading", { name: "Portal creado" })).toBeVisible();

    await page.getByRole("link", { name: "Iniciar sesión" }).click();
    await page.locator('input[type="email"]').fill("new-manager@portal.e2e.example");
    await page.locator('input[type="password"]').fill(portalPassword);
    await page.locator('button[type="submit"]').click();
    await page.waitForURL(/\/dashboard\/partner/, { timeout: 30_000 });
    await expect(page.getByRole("link", { name: "Propiedades" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Solicitudes" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Finanzas" })).toHaveCount(0);
});
