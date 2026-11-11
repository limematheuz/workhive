import { expect, test } from "@playwright/test";

for (const width of [390, 768, 1440]) for (const status of [401, 429, 503]) {
    test(`login failure ${status} follows language changes at ${width}px`, async ({ page }) => {
        test.skip(process.env.E2E_BASE_URL !== "http://localhost:3000", "Local UI regression only");
        await page.setViewportSize({ width, height: 1000 });
        await page.addInitScript(() => localStorage.setItem("locale", "es"));
        await page.route("**/api/v1/users/me", route => route.fulfill({ status: 401, json: { detail: "Not authenticated" } }));
        await page.route("**/api/v1/auth/login", route => route.fulfill({ status, json: { detail: "Private authentication diagnostic" } }));
        await page.goto("/login");
        const email = page.getByRole("textbox", { name: "Correo electrónico", exact: true });
        await email.fill("qa-language@example.com");
        await page.getByRole("textbox", { name: "Contraseña", exact: true }).fill("QA-fixture-only");
        await page.getByRole("button", { name: "Iniciar sesión", exact: true }).click();
        const spanish = status === 401 ? "Revisa el correo y la contraseña." : status === 429 ? "Demasiados intentos. Espera unos minutos y vuelve a intentarlo." : "El acceso no está disponible temporalmente. Inténtalo de nuevo en un momento.";
        const english = status === 401 ? "Check your email and password." : status === 429 ? "Too many attempts. Wait a few minutes and try again." : "Sign-in is temporarily unavailable. Please try again in a moment.";
        const feedback = page.locator('[data-login-status="error"]');
        await expect(feedback).toContainText(spanish);
        await expect(feedback).not.toContainText("Private authentication diagnostic");
        await expect(email).toHaveValue("qa-language@example.com");
        await expect(page.getByRole("button", { name: "Iniciar sesión", exact: true })).toBeEnabled();
        await page.getByRole("button", { name: "Cambiar idioma a inglés", exact: true }).click();
        await expect(feedback).toContainText(english);
        await expect(feedback).not.toContainText(spanish);
        await expect(page.getByRole("textbox", { name: "Email", exact: true })).toHaveValue("qa-language@example.com");
    });
}
