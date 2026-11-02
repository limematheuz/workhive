import { expect, test } from "@playwright/test";
import { setupNotificationWorkspace as setup } from "./helpers/notification-workspace";


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
