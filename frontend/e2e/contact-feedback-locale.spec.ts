import { expect, test } from "@playwright/test";

for (const status of [409, 429, 503]) test(`contact feedback follows locale without resubmission after ${status}`, async ({ page }) => {
    test.skip(process.env.E2E_BASE_URL !== "http://localhost:3000", "Local UI regression only");
    await page.addInitScript(() => localStorage.setItem("locale", "es"));
    let calls = 0;
    await page.route("**/api/v1/trial-requests/**", async route => {
        calls++;
        await route.fulfill({ status, json: { detail: status === 409 ? "This email already has a WorkHive account" : "Unavailable" } });
    });
    await page.goto("/contact?reason=trial");
    await page.locator("#contact-name").fill("QA Feedback");
    await page.locator('input[type="email"]').fill("qa-feedback@example.com");
    await page.locator("#contact-company").fill("QA Feedback SL");
    await page.locator('form button[type="submit"]').click();
    const copy = status === 409 ? ["Este correo ya tiene una cuenta", "This email already has a WorkHive account"] : status === 429 ? ["Demasiados intentos", "Too many attempts"] : ["No hemos podido completar el envío", "We could not complete your submission"];
    await expect(page.locator("form")).toContainText(copy[0]);
    await page.getByRole("button", { name: "Cambiar idioma a inglés", exact: true }).click();
    await expect(page.locator("form")).toContainText(copy[1]);
    expect(calls).toBe(1);
    await expect(page.locator("#contact-name")).toHaveValue("QA Feedback");
});

test("verified trial feedback changes language without consuming its token twice", async ({ page }) => {
    test.skip(process.env.E2E_BASE_URL !== "http://localhost:3000", "Local UI regression only");
    await page.addInitScript(() => localStorage.setItem("locale", "es"));
    let calls = 0;
    await page.route("**/api/v1/trial-requests/verify", async route => {
        calls++;
        await route.fulfill({ status: calls === 1 ? 200 : 400, json: calls === 1 ? { status: "email_verified" } : { detail: "Token already used" } });
    });
    await page.goto("/contact?trial_verification=qa-verification-token-0123456789");
    await expect(page.getByText("Email verificado. Revisaremos tu solicitud y te avisaremos si el acceso es aprobado.", { exact: true })).toBeVisible();
    await expect(page).toHaveURL(/\/contact$/);
    await page.getByRole("button", { name: "Cambiar idioma a inglés", exact: true }).click();
    await expect(page.getByText("Email verified. We will review your request and notify you if access is approved.", { exact: true })).toBeVisible();
    expect(calls).toBe(1);
});
