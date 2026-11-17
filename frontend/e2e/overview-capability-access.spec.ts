import { expect, test } from "@playwright/test";
import { setupNotificationWorkspace } from "./helpers/notification-workspace";

for (const width of [390, 1440]) for (const actor of ["sales", "finance", "empty", "operations"] as const) test(`overview respects ${actor} permissions at ${width}px`, async ({ context, page }) => {
    test.skip(process.env.E2E_BASE_URL !== "http://localhost:3000", "Local UI regression only");
    await page.setViewportSize({ width, height: 1000 });
    const operational = actor === "operations";
    await setupNotificationWorkspace(context, page, true, "/dashboard", { hasTasks: false, deferNavigation: true });
    const reads = { tasks: 0, locations: 0 };
    await page.route("**/api/v1/users/me", route => route.fulfill({ json: {
        id: 1, company_id: 1, full_name: "QA " + actor, is_active: true,
        role: { name: actor === "empty" ? "manager" : "viewer" },
        can_view_tasks: operational, can_manage_tasks: operational,
        can_view_locations: operational, can_manage_time: operational,
        can_view_work_reports: operational, can_manage_work_reports: operational,
        can_view_finance: actor === "finance", can_manage_finance: false,
    } }));
    await page.route("**/api/v1/organization/access", route => route.fulfill({ json: { "locations.read": operational } }));
    await page.route("**/api/v1/task-items/**", route => {
        reads.tasks++;
        return route.fulfill({ status: operational ? 200 : 403, json: operational ? [] : { detail: "Not enough permissions" } });
    });
    await page.route("**/api/v1/locations/**", route => {
        reads.locations++;
        return route.fulfill({ status: operational ? 200 : 403, json: operational ? [] : { detail: "Not enough permissions" } });
    });
    await page.goto("/dashboard");
    const main = page.locator("main.dashboard-page-scroll-region");
    if (operational) {
        await expect(main.getByRole("heading", { name: "Portal Operativo de Campo", exact: true })).toBeVisible();
        expect(reads.tasks).toBeGreaterThan(0);
        expect(reads.locations).toBeGreaterThan(0);
    } else {
        await expect(main.getByRole("heading", { name: "Tu espacio de trabajo", exact: true })).toBeVisible();
        await expect(main.getByRole("link", { name: "Ver perfil", exact: true })).toHaveAttribute("href", "/dashboard/profile");
        await expect(main.getByRole("alert")).toHaveCount(0);
        expect(reads).toEqual({ tasks: 0, locations: 0 });
    }
    await page.getByRole("button", { name: "Notifications", exact: true }).click();
    await expect(page.getByText("QA aviso persistente", { exact: true })).toBeVisible();
    if (!operational) expect(reads).toEqual({ tasks: 0, locations: 0 });
});
