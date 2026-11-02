import { expect, test } from "@playwright/test";
import { setupNotificationWorkspace as setup } from "./helpers/notification-workspace";

for (const width of [1440, 768, 390]) test(`failed inbox refresh keeps known notifications and retries at ${width}px`, async ({ context, page }) => {
    test.skip(process.env.E2E_BASE_URL !== "http://localhost:3000", "Local UI regression only");
    await page.setViewportSize({ width, height: 1000 });
    const state = await setup(context, page, false);
    await page.getByRole("button", { name: "Notifications", exact: true }).click();
    await expect(page.getByText("QA aviso persistente", { exact: true })).toBeVisible();
    state.failInbox = true;
    const reads = state.inboxReads;
    await page.getByRole("button", { name: "Notifications", exact: true }).click();
    await page.getByRole("button", { name: "Notifications", exact: true }).click();
    await expect.poll(() => state.inboxReads).toBeGreaterThan(reads);
    await expect(page.getByRole("alert").filter({ hasText: "No se pudieron actualizar los avisos." })).toBeVisible();
    await expect(page.getByText("QA aviso persistente", { exact: true })).toBeVisible();
    await expect(page.getByText("Private inbox transport detail", { exact: true })).toHaveCount(0);
    state.failInbox = false;
    state.inboxTitle = "QA aviso actualizado";
    await page.getByRole("button", { name: "Reintentar", exact: true }).click();
    await expect(page.getByText("QA aviso actualizado", { exact: true })).toBeVisible();
    await expect(page.getByText("QA aviso persistente", { exact: true })).toHaveCount(0);
    await expect(page.getByRole("alert").filter({ hasText: "No se pudieron actualizar los avisos." })).toHaveCount(0);
    expect(state.writes).toEqual([]);
});

for (const locale of ["es", "en"] as const) for (const width of [1440, 768, 390]) {
    test(`initial inbox failure is explicit and retry restores singular count ${locale} at ${width}px`, async ({ context, page }) => {
        test.skip(process.env.E2E_BASE_URL !== "http://localhost:3000", "Local UI regression only");
        await page.setViewportSize({ width, height: 1000 });
        const state = await setup(context, page, false, "/dashboard/quality", { failInbox: true, hasTasks: false, locale });
        await page.getByRole("button", { name: "Notifications", exact: true }).click();
        const error = locale === "es" ? "No se pudieron actualizar los avisos." : "Notifications could not be refreshed.";
        await expect(page.getByRole("alert").filter({ hasText: error })).toBeVisible();
        await expect(page.getByText(locale === "es" ? "No tienes notificaciones nuevas" : "No new notifications", { exact: true })).toHaveCount(0);
        await expect(page.getByText(locale === "es" ? "No hay novedades pendientes." : "No pending updates.", { exact: true })).toHaveCount(0);
        state.failInbox = false;
        await page.getByRole("button", { name: locale === "es" ? "Reintentar" : "Retry", exact: true }).click();
        await expect(page.getByText("QA aviso persistente", { exact: true })).toBeVisible();
        await expect(page.getByText(locale === "es" ? "1 aviso pendiente de atender" : "1 alert pending attention", { exact: true })).toBeVisible();
        await expect(page.getByRole("alert").filter({ hasText: error })).toHaveCount(0);
    });
}

test("a changed recipient cannot inherit cached notifications when its request fails", async ({ context, page }) => {
    test.skip(process.env.E2E_BASE_URL !== "http://localhost:3000", "Local UI regression only");
    await page.setViewportSize({ width: 1440, height: 1000 });
    const state = await setup(context, page, false, "/dashboard/quality", { hasTasks: false });
    await page.getByRole("button", { name: "Notifications", exact: true }).click();
    await expect(page.getByText("QA aviso persistente", { exact: true })).toBeVisible();
    state.userId = 2;
    state.companyId = 2;
    state.failInbox = true;
    // Exercise the provider's public bfcache recovery path with a new principal.
    await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent("pageshow", { persisted: true })));
    await expect(page.getByRole("button", { name: /QA avisos 2/ })).toBeVisible();
    await expect(page.getByRole("alert").filter({ hasText: "No se pudieron actualizar los avisos." })).toBeVisible();
    await expect(page.getByText("QA aviso persistente", { exact: true })).toHaveCount(0);
    state.failInbox = false;
    state.inboxTitle = "QA aviso otra empresa";
    await page.getByRole("button", { name: "Reintentar", exact: true }).click();
    await expect(page.getByText("QA aviso otra empresa", { exact: true })).toBeVisible();
    await expect(page.getByText("QA aviso persistente", { exact: true })).toHaveCount(0);
});

test("an older inbox response cannot resurrect a locally acknowledged notification", async ({ context, page }) => {
    test.skip(process.env.E2E_BASE_URL !== "http://localhost:3000", "Local UI regression only");
    const state = await setup(context, page, false, "/dashboard/quality", { hasTasks: false });
    const bell = page.getByRole("button", { name: "Notifications", exact: true });
    await bell.click();
    await expect(page.getByText("QA aviso persistente", { exact: true })).toBeVisible();
    await bell.click();
    const releases: Array<() => void> = [];
    await page.route("**/api/v1/notifications/**", async route => {
        if (route.request().method() !== "GET") { await route.fallback(); return; }
        const body = state.persistentRead ? [] : [{ id: 94, event_type: "qa.ready", title: "QA aviso persistente", message: "QA", entity_type: "quality", entity_id: 3, href: "/dashboard/quality", metadata_json: {}, read_at: null, created_at: new Date().toISOString() }];
        await new Promise<void>(resolve => releases.push(resolve));
        await route.fulfill({ json: body });
    });
    await bell.click();
    await expect.poll(() => releases.length).toBeGreaterThanOrEqual(1);
    await page.getByRole("button").filter({ hasText: "QA aviso persistente" }).click();
    await expect.poll(() => state.persistentRead).toBe(true);
    await bell.click();
    await expect.poll(() => releases.length).toBeGreaterThanOrEqual(2);
    const response = page.waitForResponse(res => res.url().includes("/api/v1/notifications/"));
    releases[0]();
    await (await response).finished();
    await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
    await expect(page.getByText("QA aviso persistente", { exact: true })).toHaveCount(0);
    releases.slice(1).forEach(release => release());
    await expect(page.getByText("No tienes notificaciones nuevas", { exact: true })).toBeVisible();
});

test("a different recipient never joins an old recipient's in-flight inbox read", async ({ context, page }) => {
    test.skip(process.env.E2E_BASE_URL !== "http://localhost:3000", "Local UI regression only");
    await page.setViewportSize({ width: 1440, height: 1000 });
    const state = await setup(context, page, false, "/dashboard/quality", { hasTasks: false });
    const bell = page.getByRole("button", { name: "Notifications", exact: true });
    await bell.click();
    await expect(page.getByText("QA aviso persistente", { exact: true })).toBeVisible();
    await bell.click();
    let release: () => void = () => {};
    const gate = new Promise<void>(resolve => { release = resolve; });
    let oldRead = false;
    let newRead = false;
    await page.route("**/api/v1/notifications/**", async route => {
        if (route.request().method() !== "GET") { await route.fallback(); return; }
        const readContext = route.request().headers()["x-notification-context"] ?? "";
        if (readContext.startsWith("2:2:")) {
            newRead = true;
            await route.fulfill({ status: 503, json: { detail: "Private new recipient failure" } });
            return;
        }
        oldRead = true;
        await gate;
        await route.fulfill({ json: [{ id: 94, title: "QA aviso privado anterior", message: "QA", event_type: "qa.ready", entity_type: "quality", entity_id: 3, href: "/dashboard/quality", metadata_json: {}, read_at: null, created_at: new Date().toISOString() }] });
    });
    try {
        await bell.click();
        await expect.poll(() => oldRead).toBe(true);
        state.userId = 2;
        state.companyId = 2;
        await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent("pageshow", { persisted: true })));
        await expect.poll(() => newRead).toBe(true);
        await expect(page.getByRole("alert").filter({ hasText: "No se pudieron actualizar los avisos." })).toBeVisible();
        const response = page.waitForResponse(res => res.url().includes("/api/v1/notifications/") && res.status() === 200);
        release();
        await (await response).finished();
        await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
        await expect(page.getByText("QA aviso persistente", { exact: true })).toHaveCount(0);
        await expect(page.getByText("QA aviso privado anterior", { exact: true })).toHaveCount(0);
    } finally { release(); }
});

for (const status of [403, 429]) test(`inbox status ${status} respects retained-data boundary`, async ({ context, page }) => {
    test.skip(process.env.E2E_BASE_URL !== "http://localhost:3000", "Local UI regression only");
    const state = await setup(context, page, false, "/dashboard/quality", { hasTasks: false });
    const bell = page.getByRole("button", { name: "Notifications", exact: true });
    await bell.click();
    await expect(page.getByText("QA aviso persistente", { exact: true })).toBeVisible();
    state.failInbox = true;
    state.inboxFailureStatus = status;
    await bell.click();
    await bell.click();
    await expect(page.getByRole("alert").filter({ hasText: "No se pudieron actualizar los avisos." })).toBeVisible();
    if (status === 403) await expect(page.getByText("QA aviso persistente", { exact: true })).toHaveCount(0);
    else await expect(page.getByText("QA aviso persistente", { exact: true })).toBeVisible();
    state.failInbox = false;
    await page.getByRole("button", { name: "Reintentar", exact: true }).click();
    await expect(page.getByText("QA aviso persistente", { exact: true })).toBeVisible();
});
