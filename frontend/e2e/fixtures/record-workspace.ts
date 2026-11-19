import type { BrowserContext, Page } from "@playwright/test";

export const base = process.env.E2E_BASE_URL ?? "";
const at = "2026-11-18T10:00:00Z";
export const employee = (id: number, company: number) => ({ id, name: `Persona ${id} empresa ${company}`, position: "Limpieza", team: "Equipo QA", monthly_hours: "160", hourly_cost: "14", history: {},
    profile: { contract: "Indefinido", state: "Activo", identifier: "", availability: "", documents: [], gross: "0", extra: "0", bonus: "0", insurance: "0", other: "0" } });
const incident = (id: number, status = "open") => ({ id, title: `Incidencia ${id}`, location_id: 7, inspection_id: null, inspection_item_id: null, description: "Seguimiento autorizado", severity: "medium", status, created_at: at, resolved_at: null, corrective_actions: [], evidence: [] });
const session = (id: number) => ({ id, user_id: 8011, notes: "Fichaje histórico fuera del listado", location_id: 7, location_name: "Centro QA", start_time: at, end_time: "2026-11-18T12:00:00Z", paused_seconds: 600, paused_at: null, created_at: at, updated_at: at });

export async function fixture(context: BrowserContext, page: Page) {
    const state = { company: 1, incidents: true, notFound: new Set<string>(), reads: [] as string[],
        holds: new Map<string, Promise<void>>(), denied: new Set<string>(),
        permissions: { "work.read": false, "quality.incidents.read": true, "labor_costs.read": true, "time.manage": true } as Record<string, boolean>,
        overrides: new Map<string, (company: number) => unknown>() };
    const payload = Buffer.from(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600 })).toString("base64url");
    await context.addCookies([{ name: "auth_token", value: `fixture.${payload}.not-a-backend-token`, url: base }]);
    await page.addInitScript(() => localStorage.setItem("locale", "es"));
    await page.route("**/api/v1/**", async route => {
        const path = new URL(route.request().url()).pathname.replace(/\/$/, "");
        const company = state.company;
        state.reads.push(path);
        const hold = state.holds.get(path); state.holds.delete(path);
        if (hold) await hold;
        if (route.request().failure()) return;
        if (state.denied.has(path)) { await route.fulfill({ status: 403, json: { detail: "Acceso restringido a este módulo." } }); return; }
        if (state.notFound.has(path)) { await route.fulfill({ status: 404, json: { detail: "Registro no disponible para este acceso." } }); return; }
        if (state.overrides.has(path)) { await route.fulfill({ json: state.overrides.get(path)!(company) }); return; }
        let json: unknown = [];
        if (path === "/api/v1/users/me") json = { id: 8011, email: "fixture@example.test", full_name: "Cuenta QA", role_id: 1, role: { name: "admin" }, company_id: company, is_active: true, can_view_labor_costs: true, can_manage_labor_costs: false, can_view_finance: false, can_manage_finance: false, can_view_quality: false, can_manage_quality: false, can_manage_time: state.permissions["time.manage"] === true, can_view_work_reports: state.permissions["work.read"] === true, can_manage_work_reports: false, can_manage_work: false };
        else if (path === "/api/v1/auth/csrf") json = { csrf_token: "fixture-csrf" };
        else if (path === "/api/v1/organization/access") json = state.permissions;
        else if (path === "/api/v1/companies/current/entitlements") json = { entitlements: ["organization", "quality", "hr", "time_tracking", "locations", "work_orders"].map(name => ({ code: "features." + name, value_type: "boolean", value: true })) };
        else if (path === "/api/v1/session/companies") json = { current_company_id: company, companies: [{ id: company, name: `Empresa QA ${company}`, access_class: "admin", disabled: false, disabled_reason: null }] };
        else if (/^\/api\/v1\/companies\/\d+$/.test(path)) json = { id: company, name: `Empresa QA ${company}`, onboarding_completed: true };
        else if (path === "/api/v1/quality/access") json = { can_read_locations: false, sections: Object.fromEntries(["templates", "inspections", "incidents", "complaints"].map(section => [section, { can_read: section === "incidents" && state.incidents, can_manage: false, read_locations: null, manage_locations: [] }])) };
        else if (path === "/api/v1/quality/incidents") json = [incident(401), incident(402, "in_progress"), incident(403, "resolved"), incident(404, "closed")];
        else if (/^\/api\/v1\/quality\/incidents\/\d+$/.test(path)) json = incident(Number(path.split("/").at(-1)));
        else if (/^\/api\/v1\/staff\/\d+$/.test(path)) json = employee(Number(path.split("/").at(-1)), company);
        else if (path === "/api/v1/worker-workspace") json = { employee: { id: 88, name: "Cuenta QA", position: "Limpieza" }, features: ["features.time_tracking"], can_track_time: true };
        else if (path === "/api/v1/work-sessions/active") json = null;
        else if (/^\/api\/v1\/work-sessions\/\d+$/.test(path)) json = session(Number(path.split("/").at(-1)));
        else if (path === "/api/v1/session/applications") json = { current_application: "internal", current_key: "internal:1", applications: [] };
        else if (path === "/api/v1/traffic/page-view") { await route.fulfill({ status: 204 }); return; }
        await route.fulfill({ json });
    });
    return state;
}
