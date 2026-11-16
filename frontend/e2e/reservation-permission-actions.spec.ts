import { expect, test } from "@playwright/test";
import { setupNotificationWorkspace } from "./helpers/notification-workspace";

for (const width of [390, 1440]) for (const allowed of [false, true]) {
    test(`reservation ${allowed ? "editable" : "read-only"} actions at ${width}px`, async ({ context, page }) => {
        test.skip(process.env.E2E_BASE_URL !== "http://localhost:3000", "Local intercepted UI only");
        await page.setViewportSize({ width, height: 1000 });
        await setupNotificationWorkspace(context, page, true, "/dashboard");
        const checkIn = new Date(Date.now() + 86400000).toISOString();
        const checkOut = new Date(Date.now() + 172800000).toISOString();
        let writes = 0;
        await page.route("**/api/v1/**", async (route, request) => {
            const path = new URL(request.url()).pathname.replace(/\/$/, "");
            if (path.endsWith("users/me")) return route.fulfill({ json: { id: 1, company_id: 1, role_id: 2, role: { name: "manager" }, is_active: true, full_name: "QA permisos" } });
            if (path.endsWith("companies/current/entitlements")) return route.fulfill({ json: { entitlements: [{ code: "features.planning", value_type: "boolean", value: true }] } });
            if (path.endsWith("locations")) return route.fulfill({ json: [{ id: 15, name: "QA reserva por ámbito", address: "Dirección QA", city: "QA", owner_company_id: 1, managing_company_id: 1, can_manage_reservations: allowed }] });
            if (path.endsWith("reservations") && request.method() === "GET") return route.fulfill({ json: [{ id: 80, location_id: 15, owner_company_id: 1, guest_count: 2, stay_type: "guest", status: "confirmed", source: "manual", cleaning_required: false, check_in_at: checkIn, check_out_at: checkOut, created_at: checkIn, updated_at: checkIn }] });
            if (path.includes("/reservations") && request.method() !== "GET") {
                writes++;
                return route.fulfill({ status: 403, json: { detail: "Not enough permissions" } });
            }
            return route.fallback();
        });
        await page.goto(`/dashboard/reservations${allowed ? "" : "?reservationId=80"}`);
        await expect(page.locator("article")).toHaveCount(1);
        const edit = page.getByRole("button", { name: "Editar", exact: true });
        const cancel = page.getByRole("button", { name: "Cancelar", exact: true });
        if (allowed) {
            await expect(edit).toHaveCount(1);
            await edit.click();
            const dialog = page.getByRole("dialog");
            await expect(dialog).toBeVisible();
            await dialog.getByRole("button", { name: "Cerrar", exact: true }).click();
        } else {
            await expect(page.getByRole("dialog")).toHaveCount(0);
            await expect(edit).toHaveCount(0);
            await expect(cancel).toHaveCount(0);
            await expect(page.getByRole("dialog")).toHaveCount(0);
        }
        expect(writes).toBe(0);
    });
}
