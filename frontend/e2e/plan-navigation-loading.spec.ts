import { expect, test } from "@playwright/test";
import { setupNotificationWorkspace } from "./helpers/notification-workspace";

test("an unresolved plan never flashes unavailable modules in the sidebar", async ({ context, page }) => {
    test.skip(process.env.E2E_BASE_URL !== "http://localhost:3000", "Local UI regression only");
    await setupNotificationWorkspace(context, page, true, "/dashboard/quality", { hasTasks: false });
    await page.route("**/api/v1/users/me", route => route.fulfill({ json: {
        id: 1, company_id: 1, full_name: "QA planes", role: { name: "manager" },
        is_active: true, can_view_quality: true, can_view_work_reports: true,
    } }));
    let release = () => {};
    const gate = new Promise<void>(resolve => { release = resolve; });
    let requested = false;
    await page.route("**/api/v1/companies/current/entitlements", async route => {
        requested = true;
        await gate;
        await route.fulfill({ json: { entitlements: [
            { code: "features.work_orders", value_type: "boolean", value: true },
            { code: "features.inventory", value_type: "boolean", value: false },
            { code: "features.planning", value_type: "boolean", value: false },
        ] } });
    });
    try {
        await page.reload();
        await expect.poll(() => requested).toBe(true);
        await page.getByRole("button", { name: /^Operación$/i }).click();
        await expect(page.getByRole("link", { name: "Inventario", exact: true })).toHaveCount(0);
        await expect(page.getByRole("link", { name: "Reservas", exact: true })).toHaveCount(0);
        release();
        await expect(page.getByRole("link", { name: "Tareas", exact: true })).toBeVisible();
        await expect(page.getByRole("link", { name: "Inventario", exact: true })).toHaveCount(0);
    } finally { release(); }
});
