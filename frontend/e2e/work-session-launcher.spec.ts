import { expect, test } from "@playwright/test";
import { setupNotificationWorkspace } from "./helpers/notification-workspace";

test.beforeEach(() => test.skip(process.env.E2E_BASE_URL !== "http://localhost:3000", "Local UI regression only"));

async function workspace(context: Parameters<typeof setupNotificationWorkspace>[0], page: Parameters<typeof setupNotificationWorkspace>[1], locale: "es" | "en", session: unknown = null) {
    await setupNotificationWorkspace(context, page, true, "/dashboard", { locale });
    await page.route("**/api/v1/task-items/**", route => route.fulfill({ json: [{ id: 5, title: "QA trabajo asignado", user_id: 1, location_id: 15, status: "accepted", priority: "medium", unit: "servicio", created_at: new Date().toISOString() }] }));
    await page.route("**/api/v1/work-sessions/active", route => route.fulfill({ json: session }));
    await page.reload();
}

for (const locale of ["es", "en"] as const) for (const width of [390, 768, 1440]) {
    test(`shift panel opens assigned work in ${locale} at ${width}px`, async ({ context, page }) => {
        await page.setViewportSize({ width, height: 1000 });
        await workspace(context, page, locale);
        const panel = page.getByRole("region", { name: locale === "es" ? "Tu jornada" : "Your shift", exact: true });
        await expect(panel).toBeVisible();
        await expect(panel).toContainText("QA trabajo asignado");
        await panel.getByRole("button", { name: locale === "es" ? "Abrir trabajo" : "Open job", exact: true }).click();
        await expect(page.getByRole("dialog", { name: "QA trabajo asignado", exact: true })).toBeVisible();
    });
}

for (const width of [390, 1440]) for (const paused of [false, true]) test(`active shift controls remain clear at ${width}px paused=${paused}`, async ({ context, page }) => {
    await page.setViewportSize({ width, height: 1000 });
    const session = { id: 90, user_id: 1, task_item_id: 5, location_id: 15, start_time: new Date(Date.now() - 120000).toISOString(), end_time: null, paused_at: paused ? new Date().toISOString() : null, paused_seconds: 0 };
    await workspace(context, page, "es", session);
    const panel = page.getByRole("region", { name: "Tu jornada", exact: true });
    await expect(panel.getByRole("button", { name: paused ? "Reanudar Jornada" : "Pausar Jornada", exact: true })).toBeVisible();
    await expect(panel.getByRole("button", { name: "Fichar Salida", exact: true })).toBeVisible();
    await expect(panel.getByRole("button", { name: "Abrir trabajo", exact: true })).toHaveCount(0);
});

test("a temporary session failure retains the confirmed timer and recovers without creating a shift", async ({ context, page }) => {
    const session = { id: 90, user_id: 1, task_item_id: 5, location_id: 15, start_time: new Date(Date.now() - 120000).toISOString(), end_time: null, paused_at: null, paused_seconds: 0 };
    await workspace(context, page, "es", session);
    const panel = page.getByRole("region", { name: "Tu jornada", exact: true });
    await expect(panel.getByRole("timer")).toBeVisible();
    let unavailable = true;
    await page.route("**/api/v1/work-sessions/active", route => route.fulfill(unavailable ? { status: 503, json: { detail: "Private failure" } } : { json: session }));
    await page.evaluate(() => window.dispatchEvent(new CustomEvent("workhive:session-changed")));
    await expect(panel.getByRole("alert")).toBeVisible();
    await expect(panel.getByRole("timer")).toBeVisible();
    await expect(panel.getByRole("button", { name: "Fichar Salida", exact: true })).toBeDisabled();
    unavailable = false;
    await panel.getByRole("button", { name: "Reintentar", exact: true }).click();
    await expect(panel.getByRole("alert")).toHaveCount(0);
    await expect(panel.getByRole("button", { name: "Fichar Salida", exact: true })).toBeEnabled();
});

test("session access denial removes the previous timer", async ({ context, page }) => {
    const session = { id: 90, user_id: 1, task_item_id: 5, location_id: 15, start_time: new Date(Date.now() - 120000).toISOString(), end_time: null, paused_at: null, paused_seconds: 0 };
    await workspace(context, page, "es", session);
    const panel = page.getByRole("region", { name: "Tu jornada", exact: true });
    await expect(panel.getByRole("timer")).toBeVisible();
    await page.route("**/api/v1/work-sessions/active", route => route.fulfill({ status: 403, json: { detail: "Denied" } }));
    await page.evaluate(() => window.dispatchEvent(new CustomEvent("workhive:session-changed")));
    await expect(panel.getByRole("alert")).toBeVisible();
    await expect(panel.getByRole("timer")).toHaveCount(0);
    await expect(panel.getByRole("button", { name: "Abrir trabajo", exact: true })).toBeDisabled();
});
