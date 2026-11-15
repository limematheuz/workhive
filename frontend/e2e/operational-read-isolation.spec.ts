import { expect, test, type Page, type BrowserContext } from "@playwright/test";

async function setup(context: BrowserContext, page: Page, destination: string) {
    const payload = Buffer.from(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600 })).toString("base64url");
    await context.addCookies([{ name: "auth_token", value: `fixture.${payload}.not-a-backend-token`, url: "http://localhost:3000" }]);
    await page.addInitScript(() => localStorage.setItem("locale", "es"));
    const state = { user: 1, company: 11, tasksStatus: 200, directoryStatus: 200, contractsStatus: 200, detailRequested: false, detailGate: null as Promise<void> | null, taskReads: 0, taskCount: 1, taskSkips: [] as number[], gate: null as Promise<void> | null };
    const quote = { id: 5, company_id: 11, quote_number: "QUO-QA-ANTERIOR", title: "Presupuesto QA anterior", status: "draft", client_id: 187, revision_number: 1, created_at: "2026-11-14T08:00:00Z", valid_until: null, base_amount: 10, tax_amount: 2.1, total_amount: 12.1, tax_rate: 0.21, discount: 0, retention: 0, equivalence_surcharge: 0, items: [] };
    const contract = { id: 4, company_id: 11, contract_number: "CON-QA-ANTERIOR", title: "Contrato QA anterior", status: "active", client_id: 187, source_quote_id: 5, source_quote_revision_id: 8, source_quote_revision_version: 2, total_amount: 10, quote_snapshot: { total_amount: 10 }, created_at: "2026-11-14T08:00:00Z", updated_at: "2026-11-14T08:00:00Z", renewal_mode: "manual", renewal_notice_days: 0, service_lines: [], covered_locations: [] };
    await page.route("**/api/v1/**", async route => {
        const path = new URL(route.request().url()).pathname.replace(/\/$/, "");
        let body: unknown = [];
        let status = 200;
        if (path.endsWith("/users/me")) body = { id: state.user, full_name: `QA Cambio ${state.user}`, company_id: state.company, role: { name: "manager" }, is_active: true, can_view_finance: true, can_manage_finance: true };
        else if (/\/companies\/\d+$/.test(path)) body = { id: state.company, name: "QA", onboarding_completed: true, subscription_status: "active" };
        else if (path.endsWith("/users/assignable")) { status = state.directoryStatus; body = [{ id: state.user, full_name: "QA Responsable", company_id: state.company, role: { name: "manager" } }]; }
        else if (path.endsWith("/locations")) body = [{ id: 19, name: "QA Sitio", company_id: state.company, owner_company_id: state.company, is_active: true }];
        else if (path.endsWith("/task-items")) {
            state.taskReads++;
            const captured = state.tasksStatus;
            await state.gate;
            status = captured;
            const query = new URL(route.request().url()).searchParams;
            const skip = Number(query.get("skip") ?? 0);
            const limit = Number(query.get("limit") ?? 500);
            state.taskSkips.push(skip);
            body = Array.from({ length: Math.min(limit, Math.max(0, state.taskCount - skip)) }, (_, index) => ({
                id: 61 + skip + index, title: skip + index === state.taskCount - 1 ? "Calendario QA permitido" : `QA anterior ${skip + index}`,
                status: "pending", priority: "medium", location_id: 19, company_id: 11, user_id: 1, unit: "service", created_at: new Date().toISOString(),
                scheduled_start_at: skip + index === state.taskCount - 1 ? null : "2000-01-01T08:00:00Z",
            }));
        } else if (path.endsWith("/service-contracts")) {
            status = state.contractsStatus;
            body = [contract];
        } else if (path.endsWith("/quotes")) { status = state.contractsStatus; body = [quote];
        } else if (path.endsWith("/quotes/5") || path.endsWith("/service-contracts/4")) {
            state.detailRequested = true;
            await state.detailGate;
            body = path.endsWith("/quotes/5") ? quote : contract;
        } else if (path.endsWith("/calendar/status")) body = { connected: false };
        else if (path.endsWith("/work-sessions/active")) body = null;
        await route.fulfill({ status, json: status === 200 ? body : { detail: "Unavailable or denied" } });
    });
    await page.goto(destination);
    return state;
}

test.beforeEach(() => test.skip(process.env.E2E_BASE_URL !== "http://localhost:3000", "Local UI regression only"));

test("calendar never fabricates a self-only directory after 403", async ({ context, page }) => {
    const state = await setup(context, page, "/dashboard/calendar");
    state.directoryStatus = 403;
    await page.reload();
    const alert = page.locator("main").getByRole("alert");
    await expect(alert).toContainText("No tienes permiso");
    await expect(alert.getByRole("button")).toHaveCount(0);
    await expect(page.getByText("Calendario QA permitido", { exact: true })).toHaveCount(0);
});

test("calendar retries initial failure and preserves confirmed data only for transient errors", async ({ context, page }) => {
    const state = await setup(context, page, "/dashboard/calendar");
    state.tasksStatus = 503;
    await page.reload();
    const alert = page.locator("main").getByRole("alert");
    await expect(alert).toContainText("No se pudo cargar el calendario");
    state.tasksStatus = 200;
    await alert.getByRole("button", { name: "Reintentar", exact: true }).click();
    const task = page.getByText("Calendario QA permitido", { exact: true });
    await expect(task).toBeVisible();
    state.tasksStatus = 503;
    await page.evaluate(() => window.dispatchEvent(new Event("focus")));
    await expect(alert).toContainText("No se pudo cargar el calendario");
    await expect(task).toBeVisible();
    state.tasksStatus = 403;
    await page.evaluate(() => window.dispatchEvent(new Event("focus")));
    await expect(alert).toContainText("No tienes permiso");
    await expect(task).toHaveCount(0);
});

for (const destination of ["calendar", "contracts"]) test(`${destination} retires the previous identity and ignores its late responses`, async ({ context, page }) => {
    const state = await setup(context, page, `/dashboard/${destination}`);
    const previous = destination === "calendar" ? page.getByText("Calendario QA permitido", { exact: true }) : page.getByRole("row", { name: "Abrir contrato CON-QA-ANTERIOR", exact: true });
    await expect(previous).toBeVisible();
    let release = () => {};
    if (destination === "calendar") {
        state.gate = new Promise<void>(resolve => { release = resolve; });
        const reads = state.taskReads;
        await page.evaluate(() => window.dispatchEvent(new CustomEvent("workhive:realtime-invalidation", { detail: ["tasks"] })));
        await expect.poll(() => state.taskReads).toBeGreaterThan(reads);
    }
    try {
        state.user = 2; state.company = 22; state.tasksStatus = 403; state.contractsStatus = 403;
        await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent("pageshow", { persisted: true })));
        await expect(page.getByRole("button", { name: /QA Cambio 2.*manager/ })).toBeVisible();
        await expect(previous).toHaveCount(0);
        state.gate = null;
        release();
        await expect(page.locator("main").getByRole("alert")).toContainText("No tienes permiso");
        await expect(previous).toHaveCount(0);
    } finally { release(); }
});

for (const destination of ["contracts", "quotes"]) test(`${destination} cannot reopen an old detail after identity changes`, async ({ context, page }) => {
    const state = await setup(context, page, `/dashboard/${destination}`);
    const row = page.getByRole("row").filter({ hasText: destination === "contracts" ? "CON-QA-ANTERIOR" : "Presupuesto QA anterior" });
    await expect(row).toBeVisible();
    let release = () => {};
    state.detailGate = new Promise<void>(resolve => { release = resolve; });
    await row.click();
    await expect.poll(() => state.detailRequested).toBe(true);
    try {
        state.user = 2; state.company = 22; state.contractsStatus = 403;
        await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent("pageshow", { persisted: true })));
        await expect(page.getByRole("button", { name: /QA Cambio 2.*manager/ })).toBeVisible();
        await expect(page.locator("main").getByRole("alert")).toContainText("No tienes permiso");
        const response = page.waitForResponse(res => new URL(res.url()).pathname.endsWith(destination === "contracts" ? "/service-contracts/4" : "/quotes/5"));
        release();
        await (await response).finished();
        await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
        await expect(page.getByRole("dialog")).toHaveCount(0);
    } finally { release(); }
});


test("calendar loads tasks beyond the first 500 records", async ({ context, page }) => {
    const state = await setup(context, page, "/dashboard/calendar");
    state.taskCount = 501;
    state.taskSkips = [];
    await page.reload();
    await expect(page.getByText("Calendario QA permitido", { exact: true })).toBeVisible();
    expect(state.taskSkips).toContain(500);
});
