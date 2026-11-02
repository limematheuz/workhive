import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import { setupNotificationWorkspace } from "./helpers/notification-workspace";

type Feed = "tasks" | "requests";
const refresh = (page: Page) => page.evaluate(() => window.dispatchEvent(new Event("focus")));
const rows = (count: number, requested: boolean, userId: number, offset = 0) => Array.from({ length: count }, (_, index) => ({ id: (requested ? 90 : 50) + offset + index, title: `QA tarea ${index}`, user_id: userId, location_id: 15, status: requested ? "requested" : "pending", priority: "medium", created_at: new Date().toISOString(), unit: "servicio", is_invoiced: false }));

async function setup(context: BrowserContext, page: Page, width = 1440, initialRole = "manager") {
    await page.setViewportSize({ width, height: 1000 });
    const state = await setupNotificationWorkspace(context, page, false, "/dashboard/quality", { hasTasks: false });
    const data = { status: 200, role: initialRole, tasks: 2, requests: 3, reads: [] as string[] };
    await page.route("**/api/v1/users/me", route => route.fulfill({ json: { id: state.userId, full_name: `QA avisos ${state.userId}`, role: { name: data.role }, company_id: state.companyId, is_active: true, can_view_quality: true } }));
    await page.route("**/api/v1/companies/current/entitlements", route => route.fulfill({ json: { entitlements: ["features.work_orders", "features.planning", "features.quality"].map(code => ({ code, value_type: "boolean", value: true })) } }));
    await page.route("**/api/v1/task-items/**", route => {
        data.reads.push(route.request().headers()["x-notification-context"] ?? "");
        if (data.status !== 200) return route.fulfill({ status: data.status, json: { detail: "QA inaccessible task feed" } });
        const requested = new URL(route.request().url()).searchParams.get("task_status") === "requested";
        return route.fulfill({ json: rows(requested ? data.requests : data.tasks, requested, state.userId) });
    });
    await page.reload();
    if (width < 768) await page.getByRole("button", { name: "Alternar navegación", exact: true }).click();
    const link = (feed: Feed) => page.locator(`a[href="/dashboard/${feed === "tasks" ? "tasks" : "reservations"}"]:visible`);
    await expect(link("tasks")).toContainText("2");
    await expect(link("requests")).toContainText("3");
    return { state, data, link };
}

test.beforeEach(() => test.skip(process.env.E2E_BASE_URL !== "http://localhost:3000", "Local UI regression only"));

for (const width of [1440, 768, 390]) for (const feed of ["tasks", "requests"] as const) for (const change of ["recipient", "denial", "role"] as const) test(`sidebar ${feed} count clears after ${change} at ${width}px`, async ({ context, page }) => {
    const { state, data, link } = await setup(context, page, width);
    data.status = change === "denial" ? 403 : 503;
    if (change !== "denial") {
        if (change === "recipient") { state.userId = 2; state.companyId = 2; }
        else data.role = "viewer";
        await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent("pageshow", { persisted: true })));
        await expect(page.getByRole("button", { name: new RegExp(`QA avisos ${state.userId}.*${data.role}`) })).toBeVisible();
    } else {
        const response = page.waitForResponse(res => res.url().includes("/task-items/") && res.status() === 403);
        await refresh(page);
        await (await response).finished();
    }
    if (feed === "requests" && change === "role") await expect(link(feed)).toHaveCount(0);
    else await expect(link(feed)).not.toContainText(feed === "tasks" ? "2" : "3");
    if (change === "role") {
        data.reads.length = 0;
        await refresh(page);
        await page.waitForTimeout(200);
        expect(data.reads.some(value => value.startsWith("sidebar-requests:"))).toBe(false);
    }
    data.status = 200;
    data.tasks = 1;
    data.requests = 1;
    if (change === "role") {
        data.role = "manager";
        await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent("pageshow", { persisted: true })));
    } else await refresh(page);
    await expect(link(feed)).toContainText("1");
});

for (const feed of ["tasks", "requests"] as const) test(`sidebar ${feed} count retains only its own successful value during temporary failure`, async ({ context, page }) => {
    const { data, link } = await setup(context, page);
    data.status = 503;
    const response = page.waitForResponse(res => res.url().includes("/task-items/") && res.status() === 503);
    await refresh(page);
    await (await response).finished();
    await expect(link(feed)).toContainText(feed === "tasks" ? "2" : "3");
    data.status = 200;
    data.tasks = 0;
    data.requests = 0;
    await refresh(page);
    await expect(link(feed)).not.toContainText(feed === "tasks" ? "2" : "3");
});

test("sidebar task pages share their read context and preserve the independent request count", async ({ context, page }) => {
    const { state, link } = await setup(context, page);
    const pages: Array<{ skip: number; context: string }> = [];
    await page.route("**/api/v1/task-items/**", async route => {
        const readContext = route.request().headers()["x-notification-context"] ?? "";
        if (!readContext.startsWith("sidebar-tasks:")) { await route.fallback(); return; }
        const skip = Number(new URL(route.request().url()).searchParams.get("skip") ?? 0);
        pages.push({ skip, context: readContext });
        await route.fulfill({ json: rows(skip === 0 ? 500 : 1, false, state.userId, skip) });
    });
    await page.evaluate(() => window.dispatchEvent(new Event("workhive:tasks-changed")));
    await expect(link("tasks")).toContainText("9+");
    expect(pages.map(value => value.skip)).toEqual([0, 500]);
    expect(new Set(pages.map(value => value.context)).size).toBe(1);
    await expect(link("requests")).toContainText("3");
});

test("an old sidebar task response cannot restore an obsolete count", async ({ context, page }) => {
    const { state, link } = await setup(context, page);
    let release = () => {};
    const gate = new Promise<void>(resolve => { release = resolve; });
    let held = "";
    let fresh = "";
    await page.route("**/api/v1/task-items/**", async route => {
        const value = route.request().headers()["x-notification-context"] ?? "";
        if (!value.startsWith("sidebar-tasks:")) { await route.fallback(); return; }
        if (!held) { held = value; await gate; await route.fulfill({ json: rows(2, false, state.userId) }); }
        else { fresh = value; await route.fulfill({ json: [] }); }
    });
    try {
        await page.evaluate(() => window.dispatchEvent(new Event("workhive:tasks-changed")));
        await expect.poll(() => held).not.toBe("");
        await refresh(page);
        await expect.poll(() => fresh).not.toBe("");
        expect(fresh).not.toBe(held);
        await expect(link("tasks")).not.toContainText("2");
        const response = page.waitForResponse(res => res.url().includes("/task-items/") && res.status() === 200);
        release();
        await (await response).finished();
        await page.waitForTimeout(300);
        await expect(link("tasks")).not.toContainText("2");
        await expect(link("requests")).toContainText("3");
    } finally { release(); }
});

test("a role change within management cannot retain the previous role's counters", async ({ context, page }) => {
    const { data, link } = await setup(context, page, 1440, "admin");
    data.status = 503;
    data.role = "manager";
    await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent("pageshow", { persisted: true })));
    await expect(page.getByRole("button", { name: /QA avisos 1.*manager/ })).toBeVisible();
    await expect(link("tasks")).not.toContainText("2");
    await expect(link("requests")).not.toContainText("3");
    await expect.poll(() => data.reads.some(value => value.startsWith("sidebar-tasks:1:1:manager:manage:"))).toBe(true);
    data.status = 200;
    data.tasks = 1;
    data.requests = 1;
    await refresh(page);
    await expect(link("tasks")).toContainText("1");
    await expect(link("requests")).toContainText("1");
});
