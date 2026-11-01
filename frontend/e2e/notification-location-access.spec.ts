import { expect, test, type Page, type BrowserContext } from "@playwright/test";
import { qualityAccessFixture } from "./helpers/quality-access";

async function setup(context: BrowserContext, page: Page, initialAccess: boolean, destination = "/dashboard/quality") {
    const token = Buffer.from(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600 })).toString("base64url");
    await context.addCookies([{ name: "auth_token", value: `fixture.${token}.not-a-backend-token`, url: "http://localhost:3000" }]);
    await page.addInitScript(() => localStorage.setItem("locale", "es"));
    const state = { allowed: initialAccess, failAccess: false, locationReads: 0, accessReads: 0, persistentRead: false, writes: [] as string[] };
    const now = new Date().toISOString();
    await page.route("**/api/v1/**", async route => {
        const path = new URL(route.request().url()).pathname.replace(/\/$/, "");
        let body: unknown = [];
        if (path.endsWith("users/me")) body = { id: 1, full_name: "QA avisos", role: { name: "viewer" }, company_id: 1, is_active: true, can_view_quality: true };
        else if (path.endsWith("companies/1")) body = { id: 1, name: "QA", onboarding_completed: true, subscription_status: "active" };
        else if (path.endsWith("organization/access")) {
            state.accessReads++;
            if (state.failAccess) { await route.fulfill({ status: 503, json: { detail: "QA transient failure" } }); return; }
            body = { "locations.read": state.allowed, "quality.incidents.read": true };
        } else if (path.endsWith("quality/access")) body = qualityAccessFixture({ "quality.incidents.read": true });
        else if (path.endsWith("locations") || /\/locations\/\d+$/.test(path)) {
            state.locationReads++;
            if (!state.allowed) { await route.fulfill({ status: 403, json: { detail: "Not enough permissions" } }); return; }
            const location = { id: 15, name: "QA sede autorizada", address: "Dirección QA", city: "QA", latitude: 0, longitude: 0 };
            body = path.endsWith("locations") ? [location] : location;
        } else if (path.endsWith("task-items")) body = [{ id: 5, title: "QA tarea de aviso", user_id: 1, location_id: 15, status: "pending", priority: "medium", created_at: now, updated_at: now, unit: "servicio", is_invoiced: false }];
        else if (path.endsWith("work-sessions/active")) body = null;
        else if (path.endsWith("notifications/task-items/5/read")) state.writes.push(path);
        else if (path.endsWith("notifications/94/read")) { state.persistentRead = true; state.writes.push(path); }
        else if (path.endsWith("notifications")) body = state.persistentRead ? [] : [{ id: 94, event_type: "qa.ready", title: "QA aviso persistente", message: "Aviso independiente del catálogo de ubicaciones", entity_type: "quality", entity_id: 3, href: "/dashboard/quality", metadata_json: {}, read_at: null, created_at: now }];
        await route.fulfill({ json: body });
    });
    await page.goto(destination);
    if (destination === "/dashboard/quality") await expect(page.getByRole("heading", { name: "Incidencias y acciones correctivas", exact: true })).toBeVisible();
    return state;
}

for (const width of [1440, 768, 390]) for (const allowed of [false, true]) {
    test(`notification metadata allowed=${allowed} preserves inbox at ${width}px`, async ({ context, page }) => {
        test.skip(process.env.E2E_BASE_URL !== "http://localhost:3000", "Local UI regression only");
        await page.setViewportSize({ width, height: 1000 });
        const state = await setup(context, page, allowed);
        await page.getByRole("button", { name: "Notifications", exact: true }).click();
        await expect(page.getByText("QA aviso persistente", { exact: true })).toBeVisible();
        await expect(page.getByText(allowed ? "QA sede autorizada" : "Ubicación #15", { exact: true })).toBeVisible();
        expect(state.locationReads).toBe(allowed ? 2 : 0);
        await page.getByRole("button").filter({ hasText: "QA aviso persistente" }).click();
        await expect.poll(() => state.persistentRead).toBe(true);
        await page.getByRole("button", { name: "Notifications", exact: true }).click();
        await expect(page.getByText("QA aviso persistente", { exact: true })).toHaveCount(0);
        await expect(page.getByRole("button", { name: /^QA tarea de aviso / })).toBeVisible();
        expect(state.writes).toEqual(["/api/v1/notifications/94/read"]);
    });
}

test("notification location revocation or permission lookup failure clears cached names and allows retry", async ({ context, page }) => {
    test.skip(process.env.E2E_BASE_URL !== "http://localhost:3000", "Local UI regression only");
    const state = await setup(context, page, true);
    await page.getByRole("button", { name: "Notifications", exact: true }).click();
    await expect(page.getByText("QA sede autorizada", { exact: true })).toBeVisible();
    for (const fail of [false, true]) {
        state.allowed = false;
        state.failAccess = fail;
        const count = state.locationReads;
        await page.getByRole("button", { name: "Notifications", exact: true }).click();
        await page.getByRole("button", { name: "Notifications", exact: true }).click();
        await expect(page.getByText("Ubicación #15", { exact: true })).toBeVisible();
        await expect(page.getByText("QA sede autorizada", { exact: true })).toHaveCount(0);
        await expect(page.getByText("QA aviso persistente", { exact: true })).toBeVisible();
        expect(state.locationReads).toBe(count);
        state.allowed = true;
        state.failAccess = false;
        await page.getByRole("button", { name: "Notifications", exact: true }).click();
        await page.getByRole("button", { name: "Notifications", exact: true }).click();
        await expect(page.getByText("QA sede autorizada", { exact: true })).toBeVisible();
    }
    expect(state.writes).toEqual([]);
});

test("late location responses cannot restore names after a newer denial", async ({ context, page }) => {
    test.skip(process.env.E2E_BASE_URL !== "http://localhost:3000", "Local UI regression only");
    const state = await setup(context, page, true);
    let release: () => void = () => {};
    const gate = new Promise<void>(resolve => { release = resolve; });
    let held = false;
    await page.route("**/api/v1/locations/**", async route => {
        held = true;
        await gate;
        await route.fulfill({ json: [{ id: 15, name: "QA nombre tardío" }] });
    });
    await page.getByRole("button", { name: "Notifications", exact: true }).click();
    await expect.poll(() => held).toBe(true);
    state.allowed = false;
    await page.getByRole("button", { name: "Notifications", exact: true }).click();
    await page.getByRole("button", { name: "Notifications", exact: true }).click();
    await expect(page.getByText("Ubicación #15", { exact: true })).toBeVisible();
    const response = page.waitForResponse(res => res.url().includes("/api/v1/locations/"));
    release();
    await (await response).finished();
    await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
    await expect(page.getByText("QA nombre tardío", { exact: true })).toHaveCount(0);
    await expect(page.getByText("Ubicación #15", { exact: true })).toBeVisible();
    await expect(page.getByText("QA aviso persistente", { exact: true })).toBeVisible();
});

for (const width of [1440, 768, 390]) test(`task notification link opens detail once at ${width}px`, async ({ context, page }) => {
    test.skip(process.env.E2E_BASE_URL !== "http://localhost:3000", "Local UI regression only");
    await page.setViewportSize({ width, height: 1000 });
    const state = await setup(context, page, false, "/dashboard?taskId=5");
    const dialog = page.getByRole("dialog", { name: "QA tarea de aviso", exact: true });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("link", { name: "Navegar con GPS", exact: true })).toHaveCount(0);
    await expect.poll(() => state.writes.filter(path => path.endsWith("notifications/task-items/5/read")).length).toBe(1);
    await dialog.getByRole("button", { name: "Close", exact: true }).click();
    await expect(dialog).toHaveCount(0);
    await page.getByRole("button", { name: "Notifications", exact: true }).click();
    await expect(dialog).toHaveCount(0);
});

for (const width of [1440, 768, 390]) test(`task navigation retains authorized zero coordinates at ${width}px`, async ({ context, page }) => {
    test.skip(process.env.E2E_BASE_URL !== "http://localhost:3000", "Local UI regression only");
    await page.setViewportSize({ width, height: 1000 });
    await setup(context, page, true, "/dashboard?taskId=5");
    const dialog = page.getByRole("dialog", { name: "QA tarea de aviso", exact: true });
    await expect(dialog).toBeVisible();
    const gps = dialog.getByRole("link", { name: "Navegar con GPS", exact: true });
    await expect(gps).toHaveAttribute("href", "https://www.google.com/maps/search/?api=1&query=0%2C0");
});
