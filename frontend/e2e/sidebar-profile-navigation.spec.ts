import { expect, test } from "@playwright/test";
import { setupNotificationWorkspace } from "./helpers/notification-workspace";

test.beforeEach(() => test.skip(process.env.E2E_BASE_URL !== "http://localhost:3000", "Local UI regression only"));

for (const width of [390, 768, 1440]) {
    test(`profile navigation leaves content accessible at ${width}px`, async ({ context, page }) => {
        await page.setViewportSize({ width, height: 1000 });
        await setupNotificationWorkspace(context, page, false);
        await page.route("**/api/v1/locations/**", route => route.fulfill({ json: [] }));
        await page.route("**/api/v1/work-sessions/stats**", route => route.fulfill({ json: { total_hours: 0, total_tasks: 0, completed_tasks: 0 } }));
        for (let visit = 0; visit < 2; visit++) {
            if (width < 768) await page.getByRole("button", { name: "Alternar navegación", exact: true }).click();
            await page.getByRole("button", { name: /QA avisos 1.*viewer/ }).click();
            await page.getByRole("menuitem", { name: "Ver perfil", exact: true }).click();
            await expect(page).toHaveURL(/\/dashboard\/profile$/);
            await expect(page.getByRole("dialog", { name: "Navegación", exact: true })).toHaveCount(0);
            await expect(page.getByRole("heading", { name: "Privacidad y tus datos", exact: true })).toBeVisible();
            if (width >= 768) await expect(page.locator('aside[data-sidebar="sidebar"]')).toBeVisible();
        }
    });
}
