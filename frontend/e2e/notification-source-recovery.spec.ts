import { expect, test } from "@playwright/test";
import { setupNotificationWorkspace } from "./helpers/notification-workspace";

for (const source of ["tasks", "reservations", "privacy"] as const) {
    for (const width of [1440, 390]) for (const status of [503, 403, 402]) {
        test(`${source} refresh ${status} preserves transient data and clears denied data at ${width}px`, async ({ context, page }, testInfo) => {
            test.skip(process.env.E2E_BASE_URL !== "http://localhost:3000", "Local UI regression only");
            await page.setViewportSize({ width, height: 1000 });
            const state = await setupNotificationWorkspace(context, page, false, "/dashboard/quality", { hasTasks: false, deferNavigation: true });
            let failed = false;
            let reads = 0;
            const now = new Date().toISOString();
            await page.route("**/api/v1/**", async route => {
                const path = new URL(route.request().url()).pathname.replace(/\/$/, "");
                if (path.endsWith("users/me")) {
                    await route.fulfill({ json: { id: 1, full_name: "QA fuentes", role: { name: "admin" }, company_id: 1, is_active: true, can_view_quality: true } });
                    return;
                }
                const matches = source === "tasks" ? path.endsWith("task-items")
                    : source === "reservations" ? path.endsWith("reservations/upcoming/arrivals")
                    : path.endsWith("privacy/requests");
                if (!matches) { await route.fallback(); return; }
                reads++;
                if (failed) { await route.fulfill({ status, json: { detail: "Private source failure" } }); return; }
                const body = source === "tasks"
                    ? [{ id: 5, title: "QA tarea recuperable", user_id: 1, location_id: 15, status: "pending", priority: "medium", created_at: now, updated_at: now, unit: "servicio", is_invoiced: false }]
                    : source === "reservations"
                        ? [{ id: 8, owner_company_id: 1, location_id: 15, guest_count: 2, check_in_at: new Date(Date.now() + 3600000).toISOString(), check_out_at: new Date(Date.now() + 86400000).toISOString(), status: "confirmed", created_at: now, updated_at: now }]
                        : [{ id: 9, request_type: "erasure", status: "pending", requested_at: now, requested_by_user_id: 7, reason: "QA" }];
                await route.fulfill({ json: body });
            });
            await page.goto("/dashboard/quality");
            const bell = page.getByRole("button", { name: "Notifications", exact: true });
            await bell.click();
            await expect(page.getByText("2 avisos pendientes de atender", { exact: true })).toBeVisible();
            failed = true;
            const before = reads;
            await bell.click(); await bell.click();
            await expect.poll(() => reads).toBeGreaterThan(before);
            const warning = page.getByRole("alert").filter({ hasText: "No se pudieron actualizar los avisos." });
            if (status === 402) await expect(warning).toHaveCount(0);
            else await expect(warning).toBeVisible();
            const target = source === "tasks" ? page.getByRole("button").filter({ hasText: "QA tarea recuperable" })
                : page.getByRole("button").filter({ hasText: source === "privacy" ? /supresi|eliminaci/i : /llegada/i });
            if (status === 503) await expect(target).toBeVisible();
            else await expect(target).toHaveCount(0);
            if (status === 503) await page.screenshot({ path: testInfo.outputPath("retained-source.png") });
            failed = false;
            if (status === 402) { await bell.click(); await bell.click(); }
            else await page.getByRole("button", { name: "Reintentar", exact: true }).click();
            await expect(page.getByText("2 avisos pendientes de atender", { exact: true })).toBeVisible();
            await expect(page.getByRole("alert").filter({ hasText: "No se pudieron actualizar los avisos." })).toHaveCount(0);
            expect(state.writes).toEqual([]);
        });
    }
}
