import { expect, test, type Page } from "@playwright/test";

type TestSource = EventTarget & { closed: boolean };
type TestWindow = Window & { qaSources: TestSource[] };

async function emit(page: Page, index: number, type: string, realtime?: boolean) {
    await page.evaluate(({ index, type, realtime }) => {
        const source = (window as unknown as TestWindow).qaSources[index];
        source.dispatchEvent(type === "error" ? new Event(type) : new MessageEvent(type, { data: JSON.stringify({ realtime }) }));
    }, { index, type, realtime });
}

for (const recovery of ["transport", "broker", "polling", "steady"]) {
    test(`clients catch up after ${recovery} recovery without an invalidation event`, async ({ context, page }) => {
        test.skip(process.env.E2E_BASE_URL !== "http://localhost:3000", "Local UI regression only");
        const payload = Buffer.from(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600 })).toString("base64url");
        await context.addCookies([{ name: "auth_token", value: `fixture.${payload}.not-a-backend-token`, url: "http://localhost:3000" }]);
        await page.addInitScript(() => {
            localStorage.setItem("locale", "es");
            const sources: TestSource[] = [];
            (window as unknown as TestWindow).qaSources = sources;
            window.EventSource = class extends EventTarget {
                closed = false;
                constructor() { super(); sources.push(this); }
                close() { this.closed = true; }
            } as unknown as typeof EventSource;
        });
        let name = "QA antes del corte";
        let reads = 0;
        await page.route("**/api/v1/**", async route => {
            const path = new URL(route.request().url()).pathname.replace(/\/$/, "");
            let body: unknown = [];
            if (path === "/api/v1/users/me") body = { id: 1, full_name: "QA", role: { name: "admin" }, company_id: 1, is_active: true };
            else if (path === "/api/v1/companies/1") body = { id: 1, name: "QA", onboarding_completed: true, subscription_status: "active" };
            else if (path === "/api/v1/clients/access") body = { can_read_clients: true, can_manage_clients: true };
            else if (path === "/api/v1/clients") { reads++; body = [{ id: 1, name, city: "QA", address: "QA", country: "España", is_active: true, company_id: 1, client_type: "individual" }]; }
            else if (path.includes("alert-count")) body = { pending_requests: 0, pending_tasks: 0, unread_reports: 0 };
            await route.fulfill({ json: body });
        });
        await page.goto("/dashboard/clients");
        await expect(page.getByText(name, { exact: true }).filter({ visible: true })).toBeVisible();
        await expect.poll(() => page.evaluate(() => (window as unknown as TestWindow).qaSources.length)).toBe(1);
        if (recovery === "steady") {
            const initialReads = reads;
            await emit(page, 0, "ready", true);
            await emit(page, 0, "connection", true);
            await emit(page, 0, "ready", true);
            // The invalidation debounce is 80ms; duplicate healthy frames must
            // not schedule a second fetch after the existing initial load.
            await page.waitForTimeout(250);
            expect(reads).toBe(initialReads);
            return;
        }
        await emit(page, 0, "ready", true);
        const previousReads = reads;
        if (recovery === "transport") {
            await emit(page, 0, "error");
            await expect.poll(() => page.evaluate(() => (window as unknown as TestWindow).qaSources.length)).toBe(2);
            expect(await page.evaluate(() => (window as unknown as TestWindow).qaSources[0].closed)).toBe(true);
        } else {
            await emit(page, 0, "connection", false);
        }
        name = "QA después del corte";
        if (recovery === "transport") await emit(page, 1, "ready", true);
        if (recovery === "broker") await emit(page, 0, "connection", true);
        await expect(page.getByText(name, { exact: true }).filter({ visible: true })).toBeVisible({ timeout: recovery === "polling" ? 14000 : 3500 });
        expect(reads).toBeGreaterThan(previousReads);
        await expect(page.getByText("QA antes del corte", { exact: true }).filter({ visible: true })).toHaveCount(0);
    });
}
