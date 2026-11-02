import { expect, type Page, type BrowserContext } from "@playwright/test";
import { qualityAccessFixture } from "./quality-access";

export async function setupNotificationWorkspace(context: BrowserContext, page: Page, initialAccess: boolean, destination = "/dashboard/quality", options: { failInbox?: boolean; hasTasks?: boolean; locale?: "es" | "en" } = {}) {
    const token = Buffer.from(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600 })).toString("base64url");
    await context.addCookies([{ name: "auth_token", value: `fixture.${token}.not-a-backend-token`, url: "http://localhost:3000" }]);
    await page.addInitScript(locale => localStorage.setItem("locale", locale), options.locale ?? "es");
    const state = { userId: 1, companyId: 1, failInbox: options.failInbox ?? false, inboxFailureStatus: 503, hasTasks: options.hasTasks ?? true, inboxTitle: "QA aviso persistente", inboxReads: 0, allowed: initialAccess, failAccess: false, locationReads: 0, accessReads: 0, persistentRead: false, writes: [] as string[] };
    const now = new Date().toISOString();
    await page.route("**/api/v1/**", async route => {
        const path = new URL(route.request().url()).pathname.replace(/\/$/, "");
        let body: unknown = [];
        if (path.endsWith("users/me")) body = { id: state.userId, full_name: `QA avisos ${state.userId}`, role: { name: "viewer" }, company_id: state.companyId, is_active: true, can_view_quality: true };
        else if (/\/companies\/\d+$/.test(path)) body = { id: state.companyId, name: "QA", onboarding_completed: true, subscription_status: "active" };
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
        } else if (path.endsWith("task-items")) body = state.hasTasks ? [{ id: 5, title: "QA tarea de aviso", user_id: 1, location_id: 15, status: "pending", priority: "medium", created_at: now, updated_at: now, unit: "servicio", is_invoiced: false }] : [];
        else if (path.endsWith("work-sessions/active")) body = null;
        else if (path.endsWith("notifications/task-items/5/read")) state.writes.push(path);
        else if (path.endsWith("notifications/94/read")) { state.persistentRead = true; state.writes.push(path); }
        else if (path.endsWith("notifications")) {
            state.inboxReads++;
            if (state.failInbox) { await route.fulfill({ status: state.inboxFailureStatus, json: { detail: "Private inbox transport detail" } }); return; }
            body = state.persistentRead ? [] : [{ id: 94, event_type: "qa.ready", title: state.inboxTitle, message: "Aviso independiente del catálogo de ubicaciones", entity_type: "quality", entity_id: 3, href: "/dashboard/quality", metadata_json: {}, read_at: null, created_at: now }];
        }
        await route.fulfill({ json: body });
    });
    await page.goto(destination);
    if (destination === "/dashboard/quality") await expect(page.getByRole("heading", { name: "Incidencias y acciones correctivas", exact: true })).toBeVisible();
    return state;
}
