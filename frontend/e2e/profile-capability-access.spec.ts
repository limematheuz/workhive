import { expect, test } from "@playwright/test";
import { setupNotificationWorkspace } from "./helpers/notification-workspace";

for (const width of [390, 1440]) for (const profile of ["finance", "sales", "empty"] as const) test(`own profile remains usable for ${profile} without operational grants at ${width}px`, async ({ context, page }) => {
    test.skip(process.env.E2E_BASE_URL !== "http://localhost:3000", "Local UI regression only");
    await page.setViewportSize({ width, height: 900 });
    await setupNotificationWorkspace(context, page, false, "about:blank", { hasTasks: false });
    const operationalReads: string[] = [];
    await page.route("**/api/v1/users/me", route => route.fulfill({ json: {
        id: 1, company_id: 1, full_name: `QA perfil ${profile}`, email: "qa-profile@example.com", is_active: true,
        role: { name: profile === "empty" ? "manager" : "viewer" },
        can_view_tasks: false, can_manage_tasks: false, can_view_locations: false, can_manage_time: false,
        can_view_finance: profile === "finance", can_manage_finance: false,
    } }));
    await page.route("**/api/v1/**", async route => {
        const path = new URL(route.request().url()).pathname;
        if (/work-sessions|\/users\/1\/(stats|tasks)|\/locations\/?$/.test(path)) {
            operationalReads.push(path);
            return route.fulfill({ status: 403, json: { detail: "Not enough permissions" } });
        }
        return route.fallback();
    });
    await page.goto("/dashboard/profile");
    const main = page.locator("main.dashboard-page-scroll-region");
    await expect(main.getByRole("heading", { name: `QA perfil ${profile}`, exact: true })).toBeVisible();
    await expect(main.getByRole("heading", { name: "Privacidad y tus datos", exact: true })).toBeVisible();
    await main.getByRole("button", { name: "Editar Datos", exact: true }).click();
    await expect(main.getByRole("heading", { name: "Configuración de Cuenta", exact: true })).toBeVisible();
    await expect(main.getByRole("heading", { name: "Error", exact: true })).toHaveCount(0);
    expect(operationalReads).toEqual([]);
});

for (const width of [390, 1440]) test(`operational users retain their own profile history at ${width}px`, async ({ context, page }) => {
    test.skip(process.env.E2E_BASE_URL !== "http://localhost:3000", "Local UI regression only");
    await page.setViewportSize({ width, height: 900 });
    await setupNotificationWorkspace(context, page, true, "about:blank", { hasTasks: false });
    await page.route("**/api/v1/users/me", route => route.fulfill({ json: {
        id: 1, company_id: 1, full_name: "QA operativo", is_active: true, role: { name: "viewer" },
        can_view_tasks: true, can_view_locations: true, can_manage_time: true,
    } }));
    await page.route("**/api/v1/users/1/stats", route => route.fulfill({ json: {
        total_hours_worked: 2, total_tasks: 1, tasks_completed: 0, tasks_pending: 1,
        active_session_id: null, locations_worked_count: 1,
    } }));
    await page.route("**/api/v1/work-sessions/?*", route => route.fulfill({ json: [{
        id: 12, user_id: 1, location_id: 15, task_item_id: null,
        start_time: "2026-11-16T08:00:00Z", end_time: "2026-11-16T10:00:00Z",
    }] }));
    await page.goto("/dashboard/profile");
    const main = page.locator("main.dashboard-page-scroll-region");
    await expect(main.getByRole("heading", { name: "QA operativo", exact: true })).toBeVisible();
    await expect(main.getByText("2.0", { exact: true })).toBeVisible();
    await expect(main.getByText("QA sede autorizada", { exact: true }).filter({ visible: true }).first()).toBeVisible();
});
