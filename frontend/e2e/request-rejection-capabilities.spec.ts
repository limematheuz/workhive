import { expect, test } from "@playwright/test";
import { setupNotificationWorkspace } from "./helpers/notification-workspace";

for (const width of [390, 1440]) for (const fails of [false, true]) test(`request rejection without a price ${fails ? "retains failed dialog" : "succeeds"} at ${width}px`, async ({ context, page }) => {
    test.skip(process.env.E2E_BASE_URL !== "http://localhost:3000", "Local UI regression only");
    await page.setViewportSize({ width, height: 1000 });
    await setupNotificationWorkspace(context, page, true, "/dashboard/reservations", { deferNavigation: true });
    const user = { id: 1, company_id: 1, full_name: "QA Operaciones", email: "qa@example.test", is_active: true, role: { name: "viewer" }, can_manage_tasks: true, can_view_tasks: true, can_view_locations: true };
    const task = { id: 5, title: "QA solicitud sin precio", user_id: 1, company_id: 1, location_id: 15, status: "requested", priority: "medium", unit: "service", price: null, quantity: 1, pricing_mode: "fixed", is_invoiced: false, description: "QA", created_at: new Date().toISOString(), updated_at: new Date().toISOString(), assignments: [], checklist_items: [], zones: [], spaces: [] };
    let rejected = false;
    let rejectCalls = 0;
    let fullDirectoryCalls = 0;
    await page.route("**/api/v1/users/me", route => route.fulfill({ json: user }));
    await page.route("**/api/v1/users/?**", route => { fullDirectoryCalls++; return route.fulfill({ status: 403, json: { detail: "Not enough permissions" } }); });
    await page.route("**/api/v1/users/assignable**", route => route.fulfill({ json: [user] }));
    await page.route("**/api/v1/companies/current/entitlements", route => route.fulfill({ json: { company_id: 1, entitlements: [{ code: "features.planning", value_type: "boolean", value: true }] } }));
    await page.route("**/api/v1/task-items/**", route => {
        const path = new URL(route.request().url()).pathname;
        if (path.endsWith("/5/reject")) {
            rejectCalls++;
            if (fails) return route.fulfill({ status: 503, json: { detail: "QA temporary failure" } });
            rejected = true;
            return route.fulfill({ json: { ...task, status: "rejected" } });
        }
        return route.fulfill({ json: path.endsWith("/5") ? task : rejected ? [] : [task] });
    });
    await page.goto("/dashboard/reservations?tab=requests&taskId=5");
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByRole("heading", { name: /^QA solicitud sin precio(?: - QA sede autorizada)?$/ })).toBeVisible();
    await expect(dialog.getByText("QA Operaciones", { exact: true })).toBeVisible();
    expect(fullDirectoryCalls).toBe(0);
    await expect(dialog.getByRole("button", { name: "Aceptar", exact: true })).toBeDisabled();
    const reject = dialog.getByRole("button", { name: "Rechazar", exact: true });
    await expect(reject).toBeEnabled();
    await reject.click();
    await expect.poll(() => rejectCalls).toBe(1);
    if (fails) {
        await expect(page.getByText("No se pudo rechazar la solicitud", { exact: true })).toBeVisible();
        await expect(dialog).toBeVisible();
        await expect(reject).toBeEnabled();
    } else {
        await expect(dialog).toHaveCount(0);
        await expect(page.getByText("Solicitud rechazada", { exact: true })).toBeVisible();
    }
});
