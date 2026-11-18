import { expect, test, type Page } from "@playwright/test";

const base = process.env.E2E_BASE_URL ?? "";
const statement = "He revisado esta revisión del archivo y confirmo mi firma simple vinculada a mi cuenta.";
const workspace = { id: 6, company_name: "Proveedor QA", client_name: "Oficinas QA", status: "active" };
function document(publicView = false) {
    return { id: 7, source_type: null, source_id: null, owner_type: "client", owner_id: 3, owner_name: "Oficinas QA", title: "Acuerdo QA", document_type: "contract", published_revision: publicView ? 1 : null, can_manage: !publicView, can_publish: !publicView, can_sign: true, current: { id: 11, revision: 1, title: "Acuerdo QA", file_name: "acuerdo.pdf", content_type: "application/pdf", size_bytes: 24, sha256: "a".repeat(64), revision_hash: "b".repeat(64), expires_on: null, expired: false, created_at: "2026-11-17T11:00:00Z", download_url: publicView ? "/api/v1/client-portal/workspaces/6/documents/7/revisions/11/download" : "/api/v1/document-register/7/revisions/11/download", signatures: [] } };
}
test.beforeEach(async ({ context, page }) => {
    test.skip(!/^http:\/\/(?:localhost|127\.0\.0\.1):(?:3000|3013)$/.test(base), "Local intercepted preview only");
    const payload = Buffer.from(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600 })).toString("base64url");
    await context.addCookies([{ name: "auth_token", value: `fixture.${payload}.not-a-backend-token`, url: base }]);
    await page.addInitScript(() => localStorage.setItem("locale", "es"));
    page.on("pageerror", error => console.error("Portal fixture page error:", error.message));
});
async function fixtures(page: Page, portal = false) {
    const writes: { path: string; body: string }[] = [];
    const row = document(portal);
    await page.route("**/api/v1/**", async route => {
        const path = new URL(route.request().url()).pathname.replace(/\/$/, ""), method = route.request().method();
        if (path === "/api/v1/traffic/page-view") { await route.fulfill({ status: 204 }); return; }
        if (method !== "GET") writes.push({ path, body: route.request().postData() ?? "" });
        let body: unknown = [];
        if (path === "/api/v1/users/me") body = { id: 1, full_name: "Persona QA", email: "qa@example.com", role: { name: portal ? "client_portal" : "admin" }, company_id: portal ? null : 1, is_active: true, can_view_finance: true, can_manage_finance: true };
        else if (path === "/api/v1/companies/1") body = { id: 1, name: "QA", onboarding_completed: true, subscription_status: "active" };
        else if (path === "/api/v1/session/companies") body = { current_company_id: 1, companies: [{ id: 1, name: "QA", access_class: "admin", disabled: false, disabled_reason: null }] };
        else if (path.endsWith("organization/access")) body = { "work.read": true, "access.members.manage": true, "clients.read": true, "locations.read": true, "labor_costs.read": true };
        else if (path.endsWith("companies/current/entitlements")) body = { entitlements: ["features.clients", "features.locations", "features.hr", "features.client_portal", "features.accountant_portal"].map(code => ({ code, value: true, value_type: "boolean" })) };
        else if (path === "/api/v1/client-portal/workspaces") body = [workspace];
        else if (path.endsWith("/6/overview")) body = { workspace, invoices: [], quotes: [], contracts: [], inspections: [], complaints: [], complaint_locations: [] };
        else if (path === "/api/v1/document-register") body = { owners: { clients: [{ id: 3, name: "Oficinas QA", can_manage: true }], locations: [], staff: [] }, records: [row], offset: 0, has_more: false, statement };
        else if (path === "/api/v1/client-portal/workspaces/6/documents") body = { records: [row], offset: 0, has_more: false, statement };
        else if (path.endsWith("/7/publication")) { row.published_revision = 1; body = row; }
        else if (path.endsWith("/7/revisions") && method === "POST") {
            row.title = "Acuerdo QA revisado";
            row.current = { ...row.current, id: 12, revision: 2, title: row.title, file_name: "revision.pdf", revision_hash: "c".repeat(64), download_url: "/api/v1/document-register/7/revisions/12/download" };
            body = row;
        } else if (path.endsWith("/sign")) { await route.fulfill({ status: 409, json: { detail: "La revisión ha cambiado. Vuelve a revisar el documento." } }); return; }
        else if (path === "/api/v1/portal-workspace") body = { clients: [{ id: 3, name: "Oficinas QA", grants: [], invitations: [] }], advisers: [], has_more: false, summary: { active_client_accesses: 0, pending_invitations: 0 }, modules: { client_portal: true, advisory: true, worker_app: false }, invitation_delivery_configured: false, can_manage_client_invitations: true };
        else if (path.endsWith("/clients/3/invitations") && method === "POST") body = { id: 9, email: "nuevo@example.com", status: "pending", delivery: "link", invitation_url: base + "/accept-client-portal-invitation#token=fixture-one-time-link-qa", verification_code: "FIXTURECODE", expires_at: "2026-12-17T11:00:00Z", created_at: "2026-11-17T11:00:00Z" };
        await route.fulfill({ json: body });
    });
    return writes;
}

test("new document revision remains private and signing a changed revision requires review", async ({ page }) => {
    const writes = await fixtures(page);
    await page.goto("/dashboard/documents", { waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: "Publicar para el cliente", exact: true }).click();
    const publish = page.getByRole("alertdialog", { name: "Publicar revisión para el cliente" });
    await expect(publish.getByRole("button", { name: "Publicar revisión", exact: true })).toBeDisabled();
    await publish.getByRole("checkbox").check();
    await publish.getByRole("button", { name: "Publicar revisión", exact: true }).click();
    await expect.poll(() => writes.length).toBe(1);
    expect(JSON.parse(writes[0].body)).toEqual({ revision_id: 11, expected_hash: "b".repeat(64) });
    await page.getByRole("button", { name: "Añadir revisión", exact: true }).click();
    const upload = page.getByRole("dialog", { name: "Añadir revisión", exact: true });
    await upload.getByLabel("Título", { exact: true }).fill("Acuerdo QA revisado");
    await upload.getByLabel("Archivo", { exact: true }).setInputFiles({ name: "revision.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4\n%%EOF") });
    await upload.getByRole("button", { name: "Guardar nueva revisión", exact: true }).click();
    await expect(page.getByText("La revisión actual sigue privada.", { exact: false })).toBeVisible();
    expect(writes[1].body).toContain('name="expected_revision"');
    expect(writes[1].body).toContain("\r\n1\r\n");
    await page.getByRole("button", { name: "Firmar revisión", exact: true }).click();
    const sign = page.getByRole("alertdialog", { name: "Firmar revisión del documento" });
    await expect(sign.getByRole("button", { name: "Confirmar firma simple" })).toBeDisabled();
    await sign.getByRole("checkbox").check();
    await sign.getByRole("button", { name: "Confirmar firma simple" }).click();
    await expect(sign.getByRole("alert")).toContainText("La revisión ha cambiado");
    expect(JSON.parse(writes[2].body)).toMatchObject({ expected_revision: 2, expected_hash: "c".repeat(64), confirmed: true });
});

test("customer documentation has only published files and no company publication actions", async ({ page }) => {
    const writes = await fixtures(page, true);
    await page.goto("/portal-cliente", { waitUntil: "domcontentloaded" });
    await expect(page.locator('[data-tab-navigation][data-tabs-ready="true"]')).toBeVisible();
    const tab = page.getByRole("tab", { name: "Documentación", exact: true });
    if (await tab.isVisible()) await tab.click();
    else { await page.getByRole("combobox", { name: "Sección del portal" }).click(); await page.getByRole("option", { name: "Documentación", exact: true }).click(); }
    await expect(page.getByRole("heading", { name: "Documentación compartida" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Publicar para el cliente" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Historial", exact: true })).toHaveCount(0);
    await page.getByRole("button", { name: "Firmar revisión", exact: true }).click();
    const sign = page.getByRole("alertdialog");
    await sign.getByRole("checkbox").check();
    await sign.getByRole("button", { name: "Confirmar firma simple" }).click();
    await expect(sign.getByRole("alert")).toContainText("La revisión ha cambiado");
    expect(writes[0].path).toBe("/api/v1/client-portal/workspaces/6/documents/7/revisions/11/sign");
    expect(JSON.parse(writes[0].body)).toMatchObject({ expected_revision: 1, expected_hash: "b".repeat(64) });
});

test("client invitation link survives the local refresh when email is unavailable", async ({ page }) => {
    const writes = await fixtures(page);
    await page.goto("/dashboard/portals", { waitUntil: "domcontentloaded" });
    await page.getByLabel("Email de la persona", { exact: true }).fill("nuevo@example.com");
    await page.getByRole("button", { name: "Crear enlace", exact: true }).click();
    const result = page.getByRole("dialog", { name: "Enlace de invitación creado", exact: true });
    await expect(result.getByLabel("Código de invitación", { exact: true })).toHaveValue("FIXTURECODE");
    await expect(result.getByLabel("Enlace de activación", { exact: true })).toHaveValue(/#token=fixture-one-time-link-qa$/);
    await expect(result.getByText("No se ha enviado ningún correo.", { exact: false })).toBeVisible();
    expect(writes).toHaveLength(1);
    expect(JSON.parse(writes[0].body)).toEqual({ email: "nuevo@example.com", delivery: "link" });
    await result.getByRole("button", { name: "He guardado el enlace y el código" }).click();
    await expect(result).toHaveCount(0);
});
