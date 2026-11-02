import { expect, test } from "@playwright/test";
import { setupNotificationWorkspace } from "./helpers/notification-workspace";

for (const width of [1440, 768, 390]) test(`late task notices cannot enter another recipient's inbox at ${width}px`, async ({ context, page }) => {
    test.skip(process.env.E2E_BASE_URL !== "http://localhost:3000", "Local UI regression only");
    await page.setViewportSize({ width, height: 1000 });
    const state = await setupNotificationWorkspace(context, page, false);
    const bell = page.getByRole("button", { name: "Notifications", exact: true });
    await bell.click();
    await expect(page.getByRole("button", { name: /^QA tarea de aviso/ })).toBeVisible();
    await bell.click();
    let release = () => {};
    const gate = new Promise<void>(resolve => { release = resolve; });
    let held = false;
    let newRead = false;
    await page.route("**/api/v1/task-items/**", async route => {
        const url = new URL(route.request().url());
        if (url.searchParams.get("user_id") === "1") {
            held = true;
            await gate;
            await route.fulfill({ json: [{ id: 5, title: "QA tarea privada anterior", user_id: 1, location_id: 15, status: "pending", priority: "medium", created_at: new Date().toISOString(), updated_at: new Date().toISOString(), unit: "servicio", is_invoiced: false }] });
        } else {
            if (url.searchParams.get("user_id") === "2") newRead = true;
            await route.fulfill({ json: [] });
        }
    });
    try {
        await bell.click();
        await expect.poll(() => held).toBe(true);
        state.userId = 2;
        state.companyId = 2;
        state.hasTasks = false;
        await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent("pageshow", { persisted: true })));
        await expect.poll(() => newRead).toBe(true);
        await expect(page.getByRole("button", { name: /^QA tarea de aviso/ })).toHaveCount(0);
        await page.evaluate(() => {
            const tracker = { leaked: false, observer: null as MutationObserver | null };
            tracker.observer = new MutationObserver(() => {
                if (document.body.textContent?.includes("QA tarea privada anterior")) tracker.leaked = true;
            });
            tracker.observer.observe(document.body, { subtree: true, childList: true, characterData: true });
            (window as unknown as { qaTaskLeak: typeof tracker }).qaTaskLeak = tracker;
        });
        const response = page.waitForResponse(res => res.url().includes("/task-items/") && res.url().includes("user_id=1"));
        release();
        await (await response).finished();
        // Allow the released fetch JSON and React transition to complete before inspecting the inbox.
        await page.waitForTimeout(300);
        const leaked = await page.evaluate(() => {
            const tracker = (window as unknown as { qaTaskLeak: { leaked: boolean; observer: MutationObserver } }).qaTaskLeak;
            tracker.observer.disconnect();
            return tracker.leaked;
        });
        expect(leaked).toBe(false);
        await page.screenshot({ path: `/tmp/workhive-notification-task-20261102/safe-inbox-${width}.png`, fullPage: true });
        await expect(page.getByText("QA tarea privada anterior", { exact: true })).toHaveCount(0);
    } finally { release(); }
});

for (const width of [1440, 768, 390]) for (const change of ["company", "role"] as const) test(`task reads separate a changed ${change} while an older read is pending at ${width}px`, async ({ context, page }) => {
    test.skip(process.env.E2E_BASE_URL !== "http://localhost:3000", "Local UI regression only");
    await page.setViewportSize({ width, height: 1000 });
    const state = await setupNotificationWorkspace(context, page, false);
    let role = "viewer";
    await page.route("**/api/v1/users/me", route => route.fulfill({ json: { id: state.userId, full_name: "QA avisos", role: { name: role }, company_id: state.companyId, is_active: true, can_view_quality: true } }));
    const bell = page.getByRole("button", { name: "Notifications", exact: true });
    await bell.click();
    await expect(page.getByText("QA tarea de aviso", { exact: true }).first()).toBeVisible();
    await bell.click();
    let release = () => {};
    const gate = new Promise<void>(resolve => { release = resolve; });
    let changed = false;
    let held = false;
    let newContext = "";
    await page.route("**/api/v1/task-items/**", async route => {
        if (new URL(route.request().url()).searchParams.get("user_id") !== "1") { await route.fulfill({ json: [] }); return; }
        if (changed) {
            newContext = route.request().headers()["x-notification-context"] ?? "";
            await route.fulfill({ json: [] });
        } else {
            held = true;
            await gate;
            await route.fulfill({ json: [{ id: 5, title: "QA tarea privada anterior", user_id: 1, location_id: 15, status: "pending", priority: "medium", created_at: new Date().toISOString(), unit: "servicio", is_invoiced: false }] });
        }
    });
    try {
        await bell.click();
        await expect.poll(() => held).toBe(true);
        if (change === "company") state.companyId = 2;
        else role = "manager";
        changed = true;
        state.hasTasks = false;
        await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent("pageshow", { persisted: true })));
        await expect.poll(() => newContext).toContain(change === "company" ? ":1:2:viewer:" : ":1:1:manager:");
        await expect(page.getByText("QA tarea de aviso", { exact: true })).toHaveCount(0);
        release();
        await page.waitForTimeout(300);
        await expect(page.getByText("QA tarea privada anterior", { exact: true })).toHaveCount(0);
    } finally { release(); }
});
