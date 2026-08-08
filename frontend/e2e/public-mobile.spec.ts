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

async function expectAuthDocumentScrollOwner(page: import("@playwright/test").Page) {
    const metrics = await page.evaluate(() => {
        const main = document.querySelector("main");
        if (!main) {
            return null;
        }
        const style = window.getComputedStyle(main);
        const scrollingElement = document.scrollingElement ?? document.documentElement;
        return {
            mainOverflowX: style.overflowX,
            mainOverflowY: style.overflowY,
            docScrollHeight: scrollingElement.scrollHeight,
            viewportHeight: window.innerHeight,
            scrollY: window.scrollY,
        };
    });

    expect(metrics).not.toBeNull();
    // visible (or clip without creating a nested Y scroller) — not auto/scroll trap
    expect(["visible", "clip"]).toContain(metrics!.mainOverflowY);
    expect(["visible", "clip"]).toContain(metrics!.mainOverflowX);
    expect(metrics!.mainOverflowY).not.toBe("auto");
    expect(metrics!.mainOverflowY).not.toBe("scroll");

    if (metrics!.docScrollHeight > metrics!.viewportHeight + 8) {
        await page.evaluate(() => {
            const scrollingElement = document.scrollingElement ?? document.documentElement;
            scrollingElement.scrollTop = 240;
        });
        const after = await page.evaluate(
            () => (document.scrollingElement ?? document.documentElement).scrollTop,
        );
        expect(after).toBeGreaterThan(40);
    }
}

test("register fits a mobile viewport and opens the trial contact form", async ({
    page,
}) => {
    await page.goto("/register");

    await expect(
        page.getByRole("heading", { name: /Cómo acceder a WorkHive/i })
    ).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await expectAuthDocumentScrollOwner(page);

    await page.getByRole("link", { name: /^Contactar$/i }).click();
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
        /producto completo durante 14 días con evaluación asistida/
    );
    await expectNoHorizontalOverflow(page);
    await expectAuthDocumentScrollOwner(page);
});

test("password recovery fits a mobile viewport", async ({ page }) => {
    await page.goto("/forgot-password");

    await expect(
        page.getByRole("heading", { name: /Recuperar acceso/i })
    ).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await expectAuthDocumentScrollOwner(page);
});

test("login fits a mobile viewport with full-width controls", async ({ page }) => {
    await page.goto("/login");

    await expect(page.locator("form").getByRole("button", { name: /Iniciar sesión/i })).toBeVisible();
    await expect(page.locator("#login-email")).toBeVisible();
    await expect(page.locator("#login-password")).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await expectAuthDocumentScrollOwner(page);

    const emailBox = await page.locator("#login-email").boundingBox();
    expect(emailBox?.width ?? 0).toBeGreaterThan(280);
});

test("subscription page document-scrolls to the bottom CTA on mobile", async ({
    page,
}) => {
    await page.goto("/subscription");

    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await expectAuthDocumentScrollOwner(page);

    const scroll = await page.evaluate(() => {
        const scrollingElement = document.scrollingElement ?? document.documentElement;
        const main = document.querySelector("main");
        scrollingElement.scrollTop = scrollingElement.scrollHeight;
        const mainRect = main?.getBoundingClientRect();
        return {
            scrollHeight: scrollingElement.scrollHeight,
            viewportHeight: window.innerHeight,
            scrollTop: scrollingElement.scrollTop,
            mainBottom: mainRect?.bottom ?? null,
            mainOverflowY: main ? getComputedStyle(main).overflowY : null,
        };
    });

    expect(scroll.scrollHeight).toBeGreaterThan(scroll.viewportHeight);
    expect(scroll.scrollTop).toBeGreaterThan(0);
    expect(scroll.mainOverflowY).not.toBe("auto");
    expect(scroll.mainOverflowY).not.toBe("scroll");
    expect(scroll.mainBottom).not.toBeNull();
    // Bottom of shell content reaches (or nearly reaches) the viewport bottom.
    expect(scroll.mainBottom!).toBeLessThanOrEqual(scroll.viewportHeight + 4);
});
