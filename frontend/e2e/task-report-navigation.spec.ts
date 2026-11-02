import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import { setupNotificationWorkspace } from "./helpers/notification-workspace";
import type { TaskReport } from "../src/services/task-report.service";

function report(id: number): TaskReport {
    return { id, task_item_id: id, reporter_user_id: 1, reporter_company_id: 1, requesting_company_id: null, report_type: "note", title: null, description: `Contenido privado QA ${id}`, issue_type: null, element: null, file_name: null, checklist_item_id: null, checklist_item_label: null, reporter_name: "QA persona", reporter_company_name: "QA empresa", requesting_company_name: null, task_title: `QA reporte ${id}`, location_name: "QA ubicación", media_url: null, created_at: new Date().toISOString() };
}

async function setup(context: BrowserContext, page: Page, query = "reportId=19") {
    const principal = await setupNotificationWorkspace(context, page, false, "/dashboard/quality", { hasTasks: false });
    const state = { fail: false, acknowledgements: [] as number[] };
    await page.route("**/api/v1/task-reports/**", async route => {
        if (new URL(route.request().url()).pathname.endsWith("/notifications/read")) {
            state.acknowledgements.push(principal.userId);
            await route.fulfill({ status: 204 });
        } else if (state.fail) await route.fulfill({ status: 503, json: { detail: "Private report transport failure" } });
        else await route.fulfill({ json: [report(19), report(20)] });
    });
    await page.goto(`/dashboard/task-reports${query ? `?${query}` : ""}`);
    await expect(page.getByRole("heading", { name: "Reportes de campo", exact: true })).toBeVisible();
    return { principal, state };
}

test.beforeEach(() => test.skip(process.env.E2E_BASE_URL !== "http://localhost:3000", "Local UI regression only"));

for (const width of [1440, 768, 390]) test(`report URL opens its detail once and closing preserves unrelated parameters at ${width}px`, async ({ context, page }) => {
    await page.setViewportSize({ width, height: 1000 });
    await setup(context, page, "reportId=19&origin=qa");
    const dialog = page.getByRole("dialog", { name: "QA reporte 19", exact: true });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText("Contenido privado QA 19", { exact: true })).toBeVisible();
    await dialog.getByRole("button", { name: "Close", exact: true }).click();
    await expect(dialog).toHaveCount(0);
    await expect(page).toHaveURL(/\/dashboard\/task-reports\?origin=qa$/);
    await page.setViewportSize({ width: width === 390 ? 768 : 390, height: 1000 });
    await expect(dialog).toHaveCount(0);
});

test("a new recipient cannot retain a previous recipient's report detail or history", async ({ context, page }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    const { principal, state } = await setup(context, page, "");
    await page.getByRole("button", { name: /QA reporte 19/ }).click();
    await expect(page.getByText("Contenido privado QA 19", { exact: true })).toBeVisible();
    state.fail = true;
    principal.userId = 2;
    principal.companyId = 2;
    const identity = page.waitForResponse(response => new URL(response.url()).pathname.endsWith("/users/me"));
    await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent("pageshow", { persisted: true })));
    await (await identity).finished();
    await expect(page.getByText("Contenido privado QA 19", { exact: true })).toHaveCount(0);
    await expect(page.getByRole("button", { name: /QA reporte 19/ })).toHaveCount(0);
});

test("tablet report cards keep one readable column alongside the sidebar", async ({ context, page }) => {
    await page.setViewportSize({ width: 768, height: 1000 });
    await setup(context, page, "");
    const first = page.getByRole("button", { name: /QA reporte 19/ });
    const second = page.getByRole("button", { name: /QA reporte 20/ });
    await expect(first).toBeVisible();
    const a = await first.boundingBox();
    const b = await second.boundingBox();
    expect(a).not.toBeNull();
    expect(b).not.toBeNull();
    expect(b!.x).toBe(a!.x);
    expect(b!.y).not.toBe(a!.y);
});

for (const id of ["999", "bad", "0", "9007199254740992"]) test(`unavailable report link ${id} exposes no detail`, async ({ context, page }) => {
    await setup(context, page, `reportId=${id}`);
    await expect(page.getByText("El reporte no está disponible o no tienes acceso.", { exact: true })).toBeVisible();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page.getByRole("button", { name: /QA reporte 19/ })).toBeVisible();
});

test("a read-only report offers no edit or delete actions", async ({context, page}) => {
    await setup(context, page);
    const dialog = page.getByRole("dialog", { name: "QA reporte 19", exact: true });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("button", { name: /Editar|Eliminar/i })).toHaveCount(0);
});

test("a late history read cannot reveal old reports or acknowledge the new account", async ({context, page}) => {
    const {principal, state} = await setup(context, page, "");
    await expect(page.getByRole("button", {name: /QA reporte 19/})).toBeVisible();
    state.acknowledgements.length = 0;
    let release!: () => void;
    let entered!: () => void;
    let finished!: () => void;
    const gate = new Promise<void>(resolve => {release = resolve;});
    const started = new Promise<void>(resolve => {entered = resolve;});
    const settled = new Promise<void>(resolve => {finished = resolve;});
    let held = false;
    await page.route("**/api/v1/task-reports/?**", async route => {
        if (!held) {
            held = true;
            entered();
            await gate;
            try { await route.fulfill({json: [report(19)]}); } finally { finished(); }
        } else await route.fulfill({status: 503, json: {detail: "QA failure"}});
    });
    await page.reload({waitUntil: "domcontentloaded"});
    await started;
    principal.userId = 2;
    principal.companyId = 2;
    const identity = page.waitForResponse(response => new URL(response.url()).pathname.endsWith("/users/me"));
    await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent("pageshow", {persisted: true})));
    await (await identity).finished();
    await expect(page.getByText("No se pudo cargar el historial de reportes.", {exact:true})).toBeVisible();
    release();
    await settled;
    await expect(page.getByRole("button", {name: /QA reporte 19/})).toHaveCount(0);
    expect(state.acknowledgements).toEqual([]);
});
