import { expect, test } from "@playwright/test";
import { setupNotificationWorkspace } from "./helpers/notification-workspace";

for (const width of [390, 1440]) test(`reading a persistent task never resurrects its fallback at ${width}px`, async ({ context, page }) => {
    test.skip(process.env.E2E_BASE_URL !== "http://localhost:3000", "Local UI regression only");
    await page.setViewportSize({ width, height: 950 });
    await setupNotificationWorkspace(context, page, true);
    let readAt: string | null = null;
    const createdAt = new Date(Date.now() - 60_000).toISOString();
    await page.route("**/api/v1/notifications/**", async route => {
        const path = new URL(route.request().url()).pathname;
        if (path.endsWith("/task-items/5/read")) {
            readAt = new Date().toISOString();
            await route.fulfill({ status: 204 });
        } else if (path.endsWith("/task-items/acknowledged")) {
            await route.fulfill({ json: readAt ? [{ task_item_id: 5, read_at: readAt }] : [] });
        } else {
            await route.fulfill({ json: readAt ? [] : [{ id: 101, event_type: "task.assigned", title: "Asignación QA", message: "Tarea pendiente QA", entity_type: "task_item", entity_id: 5, href: "/dashboard?taskId=5", metadata_json: {}, read_at: null, created_at: createdAt }] });
        }
    });
    await page.reload();
    const bell = page.getByRole("button", { name: "Notifications", exact: true });
    await bell.click();
    await expect(page.getByText("1 aviso pendiente de atender", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Marcar como vistas", exact: true }).click();
    await expect(page.getByText("No hay novedades pendientes.", { exact: true })).toBeVisible();
    await expect.poll(() => readAt).not.toBeNull();
    // A fresh browser has no local dismissals; the server acknowledgement must suffice.
    await page.evaluate(() => localStorage.removeItem("workhive_dismissed_notifications_v2_1"));
    await page.reload();
    await bell.click();
    await expect(page.getByText("No hay novedades pendientes.", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: /^QA tarea de aviso/ })).toHaveCount(0);
});

test("the inbox counts every page beyond 200 persistent notices", async ({ context, page }) => {
    test.skip(process.env.E2E_BASE_URL !== "http://localhost:3000", "Local UI regression only");
    await setupNotificationWorkspace(context, page, true, "/dashboard/quality", { hasTasks: false });
    const items = Array.from({ length: 205 }, (_, index) => ({ id: index + 1,
        event_type: "qa.ready", title: `Aviso QA ${index}`, message: "Datos ficticios",
        entity_type: "quality", entity_id: index, href: "/dashboard/quality",
        metadata_json: {}, read_at: null, created_at: new Date().toISOString() }));
    await page.route("**/api/v1/notifications/**", async route => {
        const url = new URL(route.request().url());
        const skip = Number(url.searchParams.get("skip") ?? 0);
        await route.fulfill({ json: url.pathname.endsWith("/acknowledged") ? [] : items.slice(skip, skip + 200) });
    });
    await page.reload();
    await page.getByRole("button", { name: "Notifications", exact: true }).click();
    await expect(page.getByText("205 avisos pendientes de atender", { exact: true })).toBeVisible();
});
