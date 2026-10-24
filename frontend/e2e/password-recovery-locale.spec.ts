import { expect, test } from "@playwright/test";

test("recovery failure follows the selected language without losing the email", async ({ page }) => {
    await page.route("**/api/v1/auth/forgot-password", async (route) => {
        await route.fulfill({
            status: 503,
            contentType: "application/json",
            body: JSON.stringify({ detail: "Email service is unavailable" }),
        });
    });

    await page.goto("/forgot-password");
    const email = page.locator("#forgot-password-email");
    await email.fill("qa-recovery@example.com");
    await page.getByRole("button", { name: "Enviar enlace" }).click();

    const form = page.locator("form");
    await expect(form.getByText("No hemos podido enviar el enlace de recuperación. Inténtalo de nuevo más tarde.")).toBeVisible();
    await page.getByRole("button", { name: "Cambiar idioma a inglés" }).click();

    await expect(page.getByRole("heading", { name: "Recover access" })).toBeVisible();
    await expect(form.getByText("We could not send the recovery link. Please try again later.")).toBeVisible();
    await expect(email).toHaveValue("qa-recovery@example.com");
});
