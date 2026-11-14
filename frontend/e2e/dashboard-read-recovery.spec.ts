import { expect, test } from "@playwright/test";
import { setupNotificationWorkspace } from "./helpers/notification-workspace";

test.beforeEach(() => test.skip(process.env.E2E_BASE_URL !== "http://localhost:3000", "Local UI regression only"));

for (const width of [390, 768, 1440]) {
    test(`dashboard retains its confirmed tasks on temporary failure at ${width}px`, async ({ context, page }) => {
        await page.setViewportSize({ width, height: 1000 });
        await setupNotificationWorkspace(context, page, true, "/dashboard");
        const task = page.getByRole("button", { name: "QA tarea de aviso", exact: true });
        await page.getByRole("tab", { name: /Todo/i }).click();
        await expect(task).toBeVisible();
        await expect(page.locator('[data-dashboard-read-error]')).toHaveCount(0);
        await page.route("**/api/v1/task-items/**", route => route.fulfill({ status: 503, json: { detail: "Private failure" } }));
        await page.evaluate(() => window.dispatchEvent(new Event("focus")));
        const alert = page.locator('[data-dashboard-read-error]');
        await expect(alert).toBeVisible();
        await expect(task).toBeVisible();
        await expect(page.getByText("No tienes tareas programadas para este periodo.", { exact: true })).toHaveCount(0);
        await page.unroute("**/api/v1/task-items/**");
        await alert.getByRole("button", { name: "Reintentar", exact: true }).click();
        await expect(alert).toHaveCount(0);
        await expect(task).toBeVisible();
    });

    test(`initial dashboard read failure does not claim an empty agenda at ${width}px`, async ({ context, page }) => {
        await page.setViewportSize({ width, height: 1000 });
        await setupNotificationWorkspace(context, page, true, "/dashboard");
        await page.route("**/api/v1/task-items/**", route => route.fulfill({ status: 503, json: { detail: "Private failure" } }));
        await page.reload();
        await expect(page.locator('[data-dashboard-read-error]')).toBeVisible();
        await expect(page.getByText("No tienes tareas programadas para este periodo.", { exact: true })).toHaveCount(0);
    });
}

for (const status of [401, 403]) test(`dashboard retires tasks when access is denied with ${status}`, async ({ context, page }) => {
    await setupNotificationWorkspace(context, page, true, "/dashboard");
    await page.getByRole("tab", { name: /Todo/i }).click();
    await expect(page.getByRole("button", { name: "QA tarea de aviso", exact: true })).toBeVisible();
    if (status === 401) await page.route("**/api/v1/users/me", route => route.fulfill({ status: 401, json: { detail: "Session expired" } }));
    await page.route("**/api/v1/task-items/**", route => route.fulfill({ status, json: { detail: "Denied" } }));
    await page.evaluate(() => window.dispatchEvent(new CustomEvent("workhive:realtime-invalidation", { detail: ["tasks"] })));
    if (status === 401) await expect(page).toHaveURL(/\/login$/);
    else await expect(page.locator('[data-dashboard-read-error]')).toBeVisible();
    await expect(page.getByRole("button", { name: "QA tarea de aviso", exact: true })).toHaveCount(0);
});

test("an old dashboard response cannot appear after changing identity and tenant", async ({ context, page }) => {
    const state = await setupNotificationWorkspace(context, page, true, "/dashboard");
    await page.getByRole("tab", { name: /Todo/i }).click();
    await expect(page.getByRole("button", { name: "QA tarea de aviso", exact: true })).toBeVisible();
    let held = false;
    let release = () => {};
    const gate = new Promise<void>(resolve => { release = resolve; });
    await page.route("**/api/v1/task-items/**", async route => {
        const readContext = route.request().headers()["x-notification-context"] ?? "";
        if (readContext.startsWith("dashboard-tasks:1:1:") && !held) {
            held = true;
            await gate;
            return route.fulfill({ json: [{ id: 555, title: "QA respuesta obsoleta", user_id: 2, location_id: 15, status: "pending", unit: "servicio", created_at: new Date().toISOString() }] });
        }
        return route.fulfill({ status: 503, json: { detail: "New context unavailable" } });
    });
    try {
        await page.evaluate(() => window.dispatchEvent(new Event("focus")));
        await expect.poll(() => held).toBe(true);
        state.userId = 2;
        state.companyId = 2;
        await page.evaluate(() => {
            const observed = window as unknown as { qaOldDashboardExposed: boolean };
            observed.qaOldDashboardExposed = false;
            new MutationObserver(() => {
                if (document.body.textContent?.includes("QA respuesta obsoleta")) observed.qaOldDashboardExposed = true;
            }).observe(document.body, { childList: true, subtree: true, characterData: true });
            window.dispatchEvent(new PageTransitionEvent("pageshow", { persisted: true }));
        });
        await expect(page.getByRole("button", { name: /QA avisos 2.*viewer/ })).toBeVisible();
        await expect(page.locator('[data-dashboard-read-error]')).toBeVisible();
        const response = page.waitForResponse(res => res.url().includes("/task-items/") && res.status() === 200);
        release();
        await (await response).finished();
        await page.waitForTimeout(250);
        await expect(page.getByRole("button", { name: "QA respuesta obsoleta", exact: true })).toHaveCount(0);
        expect(await page.evaluate(() => (window as unknown as { qaOldDashboardExposed: boolean }).qaOldDashboardExposed)).toBe(false);
    } finally { release(); }
});

for (const width of [390, 768, 1440]) for (const locale of ["es", "en"] as const) {
    test(`dashboard explains denied operational reads without a connection retry at ${width}px in ${locale}`, async ({ context, page }) => {
        await page.setViewportSize({ width, height: 1000 });
        await setupNotificationWorkspace(context, page, true, "/dashboard", { locale });
        await page.getByRole("tab", { name: /Todo|All/i }).click();
        const task = page.getByRole("button", { name: "QA tarea de aviso", exact: true });
        await expect(task).toBeVisible();
        await page.route("**/api/v1/task-items/**", route => route.fulfill({ status: 403, json: { detail: "Not enough permissions" } }));
        await page.evaluate(() => window.dispatchEvent(new CustomEvent("workhive:realtime-invalidation", { detail: ["tasks"] })));
        const alert = page.locator('[data-dashboard-read-error]');
        const permissionText = locale === "es" ? "No tienes permiso para consultar parte de la información operativa. Contacta con la persona administradora si necesitas acceso." : "You do not have permission to view some operational information. Contact your administrator if you need access.";
        await expect(alert).toHaveText(permissionText);
        await expect(alert.getByRole("button")).toHaveCount(0);
        await expect(task).toHaveCount(0);
        await expect(page.getByText(locale === "es" ? "No tienes tareas programadas para este periodo." : "You have no tasks scheduled for this period.", { exact: true })).toHaveCount(0);
        await page.unroute("**/api/v1/task-items/**");
        await page.evaluate(() => window.dispatchEvent(new Event("focus")));
        await expect(alert).toHaveCount(0);
        await expect(task).toBeVisible();
    });
}

test("location denial preserves authorized tasks and independent transient errors still retry", async ({ context, page }) => {
    const state = await setupNotificationWorkspace(context, page, true, "/dashboard");
    await page.getByRole("tab", { name: /Todo/i }).click();
    const task = page.getByRole("button", { name: "QA tarea de aviso", exact: true });
    await expect(task).toBeVisible();
    state.allowed = false;
    await page.evaluate(() => window.dispatchEvent(new CustomEvent("workhive:realtime-invalidation", { detail: ["locations"] })));
    const alert = page.locator('[data-dashboard-read-error]');
    await expect(alert).toContainText("No tienes permiso");
    await expect(alert.getByRole("button")).toHaveCount(0);
    await expect(task).toBeVisible();
    await page.route("**/api/v1/task-items/**", route => route.fulfill({ status: 503, json: { detail: "Unavailable" } }));
    await page.evaluate(() => window.dispatchEvent(new CustomEvent("workhive:realtime-invalidation", { detail: ["tasks"] })));
    await expect(alert).toContainText("No se pudieron cargar");
    await expect(alert).toContainText("No tienes permiso");
    await expect(task).toBeVisible();
    state.allowed = true;
    await page.unroute("**/api/v1/task-items/**");
    await alert.getByRole("button", { name: "Reintentar", exact: true }).click();
    await expect(alert).toHaveCount(0);
    await expect(task).toBeVisible();
});
