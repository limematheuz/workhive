import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import { setupNotificationWorkspace } from "./helpers/notification-workspace";

const refreshIdentity = (page: Page) => page.evaluate(() => window.dispatchEvent(new PageTransitionEvent("pageshow", { persisted: true })));
const refreshReports = (page: Page) => page.evaluate(() => window.dispatchEvent(new Event("workhive:notifications-updated")));
const reports = (count: number) => Array.from({ length: count }, (_, index) => ({ id: index + 1, event_type: "task.reported", title: `QA reporte ${index}`, message: "QA", entity_type: "task_report", entity_id: index + 1, href: "/dashboard/task-reports", metadata_json: {}, read_at: null, created_at: new Date().toISOString() }));

async function setup(context: BrowserContext, page: Page, width: number) {
    await page.setViewportSize({ width, height: 1000 });
    const state = await setupNotificationWorkspace(context, page, false, "/dashboard/quality", { hasTasks: false });
    const inbox = { status: 200, count: 2, allowed: true, reads: 0 };
    await page.route("**/api/v1/users/me", route => route.fulfill({ json: { id: state.userId, full_name: `QA avisos ${state.userId}`, role: { name: "viewer" }, company_id: state.companyId, is_active: true, can_view_quality: true, can_view_work_reports: inbox.allowed } }));
    await page.route("**/api/v1/notifications/**", route => {
        inbox.reads++;
        return inbox.status !== 200
            ? route.fulfill({ status: inbox.status, json: { detail: "QA failure" } })
            : route.fulfill({ json: reports(inbox.count) });
    });
    await refreshIdentity(page);
    if (width < 768) await page.getByRole("button", { name: "Alternar navegación", exact: true }).click();
    const link = page.locator('a[href="/dashboard/task-reports"]:visible');
    await expect(link).toContainText("2");
    return { state, inbox, link };
}

test.beforeEach(() => test.skip(process.env.E2E_BASE_URL !== "http://localhost:3000", "Local UI regression only"));

for (const width of [1440, 768, 390]) {
    for (const scenario of ["changed recipient", "revoked access"] as const) test(`report badge clears after ${scenario} at ${width}px`, async ({ context, page }) => {
        const { state, inbox, link } = await setup(context, page, width);
        inbox.status = scenario === "changed recipient" ? 503 : 403;
        if (scenario === "changed recipient") {
            state.userId = 2;
            state.companyId = 2;
            await refreshIdentity(page);
            await expect(page.getByRole("button", { name: /QA avisos 2/ })).toBeVisible();
        } else await refreshReports(page);
        await expect(link).not.toContainText("2");
        inbox.status = 200;
        inbox.count = 1;
        await refreshReports(page);
        await expect(link).toHaveText("Reportes de campo1");
    });

    test(`report badge retains only its own count during a temporary failure at ${width}px`, async ({ context, page }) => {
        const { inbox, link } = await setup(context, page, width);
        inbox.status = 503;
        const before = inbox.reads;
        const response = page.waitForResponse(res => res.url().includes("/notifications/") && res.status() === 503);
        await refreshReports(page);
        await (await response).finished();
        await expect.poll(() => inbox.reads).toBeGreaterThan(before);
        await expect(link).toHaveText("Reportes de campo2");
        inbox.status = 200;
        inbox.count = 0;
        await refreshReports(page);
        await expect(link).toHaveText("Reportes de campo");
    });
}

test("report badge ignores an older response after an acknowledgement refresh", async ({ context, page }) => {
    const { inbox, link } = await setup(context, page, 1440);
    let release = () => {};
    const gate = new Promise<void>(resolve => { release = resolve; });
    let heldContext = "";
    let freshContext = "";
    await page.route("**/api/v1/notifications/**", async route => {
        const readContext = route.request().headers()["x-notification-context"] ?? "";
        if (!readContext.startsWith("reports:")) { await route.fallback(); return; }
        if (!heldContext) {
            heldContext = readContext;
            await gate;
            await route.fulfill({ json: reports(2) });
        } else {
            freshContext = readContext;
            await route.fulfill({ json: [] });
        }
    });
    try {
        await refreshReports(page);
        await expect.poll(() => heldContext).not.toBe("");
        inbox.count = 0;
        await refreshReports(page);
        await expect.poll(() => freshContext).not.toBe("");
        expect(freshContext).not.toBe(heldContext);
        await expect(link).toHaveText("Reportes de campo");
        const response = page.waitForResponse(res => res.url().includes("/notifications/") && res.status() === 200);
        release();
        await (await response).finished();
        await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
        await expect(link).toHaveText("Reportes de campo");
    } finally { release(); }
});

test("report access hint controls reads and discards a count after revocation", async ({ context, page }) => {
    const { inbox, link } = await setup(context, page, 1440);
    inbox.allowed = false;
    await refreshIdentity(page);
    await expect(link).toHaveCount(0);
    const contexts: string[] = [];
    page.on("request", request => {
        const value = request.headers()["x-notification-context"];
        if (value?.startsWith("reports:")) contexts.push(value);
    });
    await refreshReports(page);
    await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
    expect(contexts).toEqual([]);
    inbox.count = 0;
    inbox.allowed = true;
    await refreshIdentity(page);
    await expect(link).toHaveText("Reportes de campo");
});

test("a delayed report count cannot leak into a different recipient", async ({ context, page }) => {
    const { state, inbox, link } = await setup(context, page, 1440);
    let release = () => {};
    const gate = new Promise<void>(resolve => { release = resolve; });
    let oldRead = false;
    let newRead = false;
    await page.route("**/api/v1/notifications/**", async route => {
        const value = route.request().headers()["x-notification-context"] ?? "";
        if (!value.startsWith("reports:")) { await route.fallback(); return; }
        if (value.startsWith("reports:2:2:")) {
            newRead = true;
            await route.fulfill({ status: 503, json: { detail: "QA new recipient outage" } });
        } else {
            oldRead = true;
            await gate;
            await route.fulfill({ json: reports(2) });
        }
    });
    try {
        await refreshReports(page);
        await expect.poll(() => oldRead).toBe(true);
        state.userId = 2;
        state.companyId = 2;
        inbox.status = 503;
        await refreshIdentity(page);
        await expect.poll(() => newRead).toBe(true);
        await expect(link).toHaveText("Reportes de campo");
        const response = page.waitForResponse(res => res.url().includes("/notifications/") && res.status() === 200);
        release();
        await (await response).finished();
        await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
        await expect(link).toHaveText("Reportes de campo");
    } finally { release(); }
});
