import { expect, test } from "@playwright/test";

test.use({
    viewport: { width: 375, height: 667 },
});

async function expectNoHorizontalOverflow(page: import("@playwright/test").Page) {
    const dimensions = await page.evaluate(() => ({
        viewport: window.innerWidth,
        document: document.documentElement.scrollWidth,
    }));

    expect(dimensions.document).toBeLessThanOrEqual(dimensions.viewport);
}

test("register fits a mobile viewport and opens the trial contact form", async ({
    page,
}) => {
    await page.goto("/register");

    await expect(
        page.getByRole("heading", { name: /Solicitar acceso a WorkHive/i })
    ).toBeVisible();
    await expectNoHorizontalOverflow(page);

    await page.getByRole("link", { name: /^Contacto$/i }).click();
    await expect(page).toHaveURL(/\/contact\?reason=trial$/);
});

test("trial contact form is prefilled and fits a mobile viewport", async ({
    page,
}) => {
    await page.goto("/contact?reason=trial");

    await expect(page.getByLabel(/Asunto/i)).toHaveValue(
        "Solicitud de evaluación de WorkHive"
    );
    await expect(page.getByLabel(/Mensaje/i)).toHaveValue(
        /evaluación asistida de 14 días/
    );
    await expectNoHorizontalOverflow(page);
});

test("password recovery fits a mobile viewport", async ({ page }) => {
    await page.goto("/forgot-password");

    await expect(
        page.getByRole("heading", { name: /Olvidaste tu contraseña/i })
    ).toBeVisible();
    await expectNoHorizontalOverflow(page);
});
