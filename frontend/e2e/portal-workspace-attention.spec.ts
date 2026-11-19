import { expect, test, type BrowserContext, type Page } from "@playwright/test";

const base = process.env.E2E_BASE_URL ?? "";
async function fixture(context: BrowserContext, page: Page, kind: "client" | "adviser" | "partner") {
    const state = { overviewFailure: 0, reads: [] as string[], writes: [] as string[] };
    const payload = Buffer.from(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600 })).toString("base64url");
    await context.addCookies([{ name: "auth_token", value: `fixture.${payload}.not-a-backend-token`, url: base }]);
    await page.addInitScript(() => localStorage.setItem("locale", "es"));
    const workspace = { id: 7, company_name: "Proveedor QA", client_name: "Cliente Norte", status: "active" };
    const quote = { id: 10, quote_number: "P-QA-10", title: "Propuesta pendiente", status: "sent", valid_until: null, base_amount: 100, tax_amount: 21, total_amount: 121, revision_number: 1, lines: [] };
    const complaint = { id: 30, location_id: 10, location_name: "Centro Norte", title: "Reclamación en seguimiento", description: "Detalle compartido", category: "service", status: "submitted", customer_response: null, created_at: "2026-11-18T10:00:00Z", updated_at: "2026-11-18T10:00:00Z", resolved_at: null };
    const at = (days: number) => new Date(Date.now() + days * 86_400_000).toISOString();
    const reservations = [
        { id: 101, location_id: 10, cleaning_status: "requested", check_out_at: at(10), guest_count: 2 },
        { id: 102, location_id: 10, cleaning_status: "scheduled", check_out_at: at(1), guest_count: 2 },
        { id: 103, location_id: 10, cleaning_status: "completed", check_out_at: at(2), guest_count: 2 },
        { id: 104, location_id: 10, cleaning_status: "cancelled", check_out_at: at(3), guest_count: 2 },
        { id: 105, location_id: 10, cleaning_status: "requested", check_out_at: at(-2), guest_count: 2 },
    ];
    await page.route("**/api/v1/**", async route => {
        const request = route.request(), path = new URL(request.url()).pathname.replace(/\/$/, "");
        if (path === "/api/v1/traffic/page-view") { await route.fulfill({ status: 204 }); return; }
        state.reads.push(path); if (request.method() !== "GET") state.writes.push(`${request.method()} ${path}`);
        if (path === "/api/v1/client-portal/workspaces/7/overview" && state.overviewFailure) {
            await route.fulfill({ status: state.overviewFailure, json: { detail: "Consulta no disponible" } }); return;
        }
        let json: unknown = [];
        if (path === "/api/v1/users/me") json = { id: 13, full_name: "Cuenta del portal QA", email: "portal@example.test", company_id: kind === "partner" ? 2 : null, is_active: true, role: { name: kind === "client" ? "client_portal" : kind === "adviser" ? "external_portal" : "partner_portal" } };
        else if (path === "/api/v1/session/applications") json = { current_application: kind === "adviser" ? "adviser" : kind === "client" ? "client" : "internal", current_key: `${kind}:7`, applications: [] };
        else if (path === "/api/v1/session/companies") json = { current_company_id: null, companies: [] };
        else if (path === "/api/v1/client-portal/workspaces") json = [workspace];
        else if (path === "/api/v1/client-portal/workspaces/7/overview") json = { workspace, invoices: [], contracts: [], inspections: [], quotes: [quote, { ...quote, id: 11, quote_number: "P-QA-11", title: "Propuesta ya aceptada", status: "accepted" }], complaint_locations: [{ id: 10, name: "Centro Norte" }], complaints: [complaint, { ...complaint, id: 31, title: "Reclamación resuelta", status: "resolved" }] };
        else if (path === "/api/v1/advisory/companies") json = [{ id: 1, name: "Empresa contable QA", accounting: true, payroll: false }];
        else if (path === "/api/v1/advisory-requests/1") json = [{ id: 1, area: "accounting", description: "Justificante pendiente", response: null, created_at: "2026-11-17T09:00:00Z", answered_at: null }, { id: 2, area: "accounting", description: "Datos entregados", response: "Documentación recibida", created_at: "2026-11-16T09:00:00Z", answered_at: "2026-11-18T09:00:00Z" }];
        else if (path === "/api/v1/partner-portal/overview") json = { host_company_id: 1, host_company_name: "Proveedor QA", partner_company_id: 2, partner_company_name: "Colaborador QA", location_count: 1, upcoming_reservation_count: 4, pending_cleaning_count: 3 };
        else if (path === "/api/v1/partner-portal/locations") json = [{ id: 10, name: "Propiedad Norte", address: "Calle Norte 1", city: "Madrid", is_active: true }];
        else if (path === "/api/v1/partner-portal/reservations") json = reservations;
        await route.fulfill({ json });
    });
    return state;
}

test.beforeEach(() => test.skip(!/^http:\/\/(?:localhost|127\.0\.0\.1):(?:3000|3013)$/.test(base), "Local intercepted portal regression only"));

test("client priorities open only pending revisions and retain the supplier context", async ({ context, page }) => {
    const state = await fixture(context, page, "client");
    await page.goto("/portal-cliente");
    await expect(page.getByRole("button", { name: /^Presupuestos por aceptar: 1/ })).toBeVisible();
    await page.getByRole("button", { name: /^Presupuestos por aceptar:/ }).click();
    await expect(page.getByRole("heading", { name: "Propuesta pendiente", exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Propuesta ya aceptada", exact: true })).toHaveCount(0);
    await expect(page.getByText("Empresa proveedora: Proveedor QA · Cliente: Cliente Norte", { exact: true })).toBeVisible();
    expect(state.writes).toEqual([]);
});

test("a recoverable client refresh preserves an unfinished complaint", async ({ context, page }) => {
    const state = await fixture(context, page, "client");
    await page.goto("/portal-cliente");
    await page.getByRole("button", { name: /^Reclamaciones en seguimiento:/ }).click();
    const title = page.getByRole("textbox", { name: "Asunto", exact: true });
    await title.fill("Texto de reclamación sin enviar");
    state.overviewFailure = 503;
    await page.getByRole("button", { name: "Actualizar", exact: true }).click();
    await expect(page.getByRole("alert").filter({ hasText: "Se conserva la última consulta" })).toBeVisible();
    await expect(title).toHaveValue("Texto de reclamación sin enviar");
    expect(state.writes).toEqual([]);
});

test("advisers see pending information without loading an unauthorized payroll area", async ({ context, page }) => {
    const state = await fixture(context, page, "adviser");
    await page.goto("/gestoria");
    await page.getByRole("button", { name: /^Información pendiente: 1/ }).click();
    await expect(page.getByText("Justificante pendiente", { exact: true })).toBeVisible();
    await expect(page.getByText("Datos entregados", { exact: true })).toHaveCount(0);
    await expect(page.getByRole("tab", { name: "Laboral", exact: true })).toHaveCount(0);
    expect(state.reads.some(path => path.includes("/payroll"))).toBe(false);
    expect(state.writes).toEqual([]);
});

test("partner upcoming requests exclude terminal services and pending confirmation filters exactly", async ({ context, page }) => {
    const state = await fixture(context, page, "partner");
    await page.goto("/dashboard/partner");
    const rows = page.getByRole("row");
    await expect(rows).toHaveCount(3);
    await expect(rows.nth(1)).toContainText("Programada");
    await expect(rows.nth(2)).toContainText("Pendiente de confirmar");
    await page.getByRole("button", { name: /^Solicitudes por confirmar: 2/ }).click();
    await expect(page.getByRole("row").filter({ hasText: "Pendiente de confirmar" })).toHaveCount(2);
    await expect(page.getByRole("row").filter({ hasText: "Completada" })).toHaveCount(0);
    expect(state.writes).toEqual([]);
});
