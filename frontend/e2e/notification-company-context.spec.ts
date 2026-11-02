import { expect, test } from "@playwright/test";
import { setupNotificationWorkspace } from "./helpers/notification-workspace";

for (const width of [1440, 768, 390]) for (const feed of ["privacy", "arrivals"] as const) for (const change of ["recipient", "role"] as const) test(`${feed} notices cannot survive a changed ${change} at ${width}px`, async ({ context, page }) => {
    test.skip(process.env.E2E_BASE_URL !== "http://localhost:3000", "Local UI regression only");
    await page.setViewportSize({ width, height: 1000 });
    const state = await setupNotificationWorkspace(context, page, false, "/dashboard/quality", { hasTasks: false });
    let role = "admin";
    await page.route("**/api/v1/users/me", route => route.fulfill({ json: { id: state.userId, full_name: `QA avisos ${state.userId}`, role: { name: role }, company_id: state.companyId, is_active: true, can_view_quality: true } }));
    const pattern = feed === "privacy" ? "**/api/v1/privacy/requests" : "**/api/v1/reservations/upcoming/arrivals*";
    const label = feed === "privacy" ? "Solicitud de supresión" : "Recordatorio de llegada";
    const record = feed === "privacy"
        ? { id: 77, request_type: "erasure", status: "pending", company_id: 1, requested_by_user_id: 1, requested_at: new Date().toISOString(), reason: null, resolved_at: null, resolution_notes: null }
        : { id: 77, location_id: 15, owner_company_id: 1, check_in_at: new Date(Date.now() + 3600000).toISOString(), check_out_at: new Date(Date.now() + 86400000).toISOString(), guest_count: 2, stay_type: "guest", status: "confirmed", source: "manual", cleaning_required: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
    await page.route(pattern, route => route.fulfill({ json: [record] }));
    await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent("pageshow", { persisted: true })));
    const bell = page.getByRole("button", { name: "Notifications", exact: true });
    await bell.click();
    await expect(page.getByText(label, { exact: true })).toBeVisible();
    await bell.click();
    let release = () => {};
    const gate = new Promise<void>(resolve => { release = resolve; });
    let changed = false;
    let held = false;
    let recovered = false;
    const contexts: string[] = [];
    await page.route(pattern, async route => {
        if (changed) {
            contexts.push(route.request().headers()["x-notification-context"] ?? "");
            if (recovered) await route.fulfill({ json: [{ ...record, id: 78, company_id: state.companyId, owner_company_id: state.companyId }] });
            else await route.fulfill({ status: 503, json: { detail: "QA new context unavailable" } });
            return;
        }
        held = true;
        await gate;
        await route.fulfill({ json: [record] });
    });
    try {
        await bell.click();
        await expect.poll(() => held).toBe(true);
        if (change === "recipient") { state.userId = 2; state.companyId = 2; }
        else role = "viewer";
        changed = true;
        const identityResponse = page.waitForResponse(response => new URL(response.url()).pathname.endsWith("/users/me"));
        await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent("pageshow", { persisted: true })));
        await (await identityResponse).finished();
        await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
        if (width >= 768) await expect(page.getByRole("button", { name: new RegExp(`QA avisos ${state.userId}.*${role}`) })).toBeVisible();
        await page.evaluate(text => {
            const tracker = { leaked: Boolean(document.body.textContent?.includes(text)), observer: null as MutationObserver | null };
            tracker.observer = new MutationObserver(() => { if (document.body.textContent?.includes(text)) tracker.leaked = true; });
            tracker.observer.observe(document.body, { subtree: true, childList: true, characterData: true });
            (window as unknown as { qaCompanyLeak: typeof tracker }).qaCompanyLeak = tracker;
        }, label);
        release();
        await page.waitForTimeout(300);
        const leaked = await page.evaluate(() => {
            const tracker = (window as unknown as { qaCompanyLeak: { leaked: boolean; observer: MutationObserver } }).qaCompanyLeak;
            tracker.observer.disconnect();
            return tracker.leaked;
        });
        expect(leaked).toBe(false);
        await expect(page.getByText(label, { exact: true })).toHaveCount(0);
        if (change === "role") expect(contexts).toEqual([]);
        else expect(contexts.some(value => value.includes(":2:2:admin:"))).toBe(true);
        recovered = true;
        if (change === "role") {
            role = "admin";
            await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent("pageshow", { persisted: true })));
        } else {
            await bell.click();
            await bell.click();
        }
        await expect(page.getByText(label, { exact: true })).toBeVisible();
    } finally { release(); }
});
