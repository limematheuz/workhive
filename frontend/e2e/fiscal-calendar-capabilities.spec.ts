import { expect, test } from "@playwright/test";
import { setupNotificationWorkspace } from "./helpers/notification-workspace";

for (const width of [390, 1440]) for (const access of ["reader", "manager", "denied"] as const) test(`fiscal calendar respects ${access} capability at ${width}px`, async ({ context, page }) => {
    test.skip(process.env.E2E_BASE_URL !== "http://localhost:3000", "Local UI regression only");
    await page.setViewportSize({ width, height: 900 });
    await setupNotificationWorkspace(context, page, true, "/dashboard", { hasTasks: false });
    let reads = 0;
    const writes: string[] = [];
    await page.route("**/api/v1/users/me", route => route.fulfill({ json: {
        id: 1, company_id: 1, full_name: "QA fiscal", is_active: true,
        role: { name: access === "manager" ? "admin" : "viewer" },
        can_view_finance: access !== "denied", can_manage_finance: access === "manager",
    } }));
    await page.route("**/api/v1/fiscal-settings/**", route => {
        if (route.request().method() !== "GET") writes.push(route.request().method());
        else reads++;
        return route.fulfill({ json: { company_id: 1, quarterly_vat_enabled: true, quarterly_withholding_enabled: false, fiscal_reminder_days: 7 } });
    });
    await page.goto("/dashboard/fiscal-calendar");
    if (access === "denied") {
        await expect(page).toHaveURL(/\/dashboard$/);
        expect(reads).toBe(0);
    } else {
        const main = page.locator("main.dashboard-page-scroll-region");
        await expect(main.getByRole("heading", { name: "Obligaciones de la empresa", exact: true })).toBeVisible();
        expect(reads).toBeGreaterThan(0);
        const vat = main.locator("#quarterly-vat");
        await expect(vat).toBeChecked();
        if (access === "reader") {
            await expect(vat).toBeDisabled();
            await expect(main.getByRole("textbox", { name: "Avisar con antelación", exact: true })).toBeDisabled();
            await expect(main.getByRole("button", { name: "Guardar calendario", exact: true })).toHaveCount(0);
        } else {
            await expect(vat).toBeEnabled();
            await main.getByRole("button", { name: "Guardar calendario", exact: true }).click();
            await expect.poll(() => writes.length).toBe(1);
        }
    }
    if (access !== "manager") expect(writes).toEqual([]);
});
