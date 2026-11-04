import { selectSection } from "./helpers/select-section";
import { expect, test } from "@playwright/test";

// Browser-only fixtures: every API request is intercepted; no real member,
// invitation or company is changed. Backend policy is tested separately.
test.beforeEach(async ({ context, page }) => {
    const base = process.env.E2E_BASE_URL;
    test.skip(base !== "http://localhost:3000", "Local UI regression only");
    const payload = Buffer.from(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600 })).toString("base64url");
    await context.addCookies([{ name: "auth_token", value: `fixture.${payload}.not-a-backend-token`, url: base! }]);
    await page.addInitScript(() => { localStorage.setItem("locale", "es"); });
});

async function fixture(page: import("@playwright/test").Page, readOnly = false) {
    const capabilities = ["access.members", "access.profiles", "organization.departments", "organization.teams"];
    const permissions = Object.fromEntries(capabilities.flatMap(prefix => [
        [`${prefix}.read`, !readOnly || prefix === "organization.departments"],
        [`${prefix}.manage`, !readOnly],
    ]));
    const profiles = [
        { id: 1, name: "Administrador de empresa", description: "Control total", is_system: true, is_editable: false, is_active: true, permission_codes: ["access.members.manage"], usage: { assignments: 1, can_delete: false } },
        { id: 2, name: "Comercial", description: "Clientes sin finanzas", is_system: true, is_editable: true, is_active: true, permission_codes: ["access.members.read"], usage: { assignments: 1, can_delete: false } },
    ];
    const departments = [{ id: 1, name: "Operaciones de prueba", code: "OPS", is_active: true, parent_department_id: null, usage: { child_departments: 0, teams: 1, member_assignments: 0, profile_scopes: 0, locations: 0, can_delete: false } }];
    const members = [{ id: 20, user_id: 20, full_name: "Persona de prueba", email: "person@example.test", access_class: "responsible", status: "active", department_ids: [], team_ids: [], ended_at: null, is_anonymized: false, profile_assignments: [{ id: 1, permission_profile_id: 2, permission_profile_name: "Comercial", scopes: [{ id: 1, scope_type: "location", scope_id: 5 }, { id: 2, scope_type: "team", scope_id: 3 }] }] }];
    const writes: unknown[] = [];
    const requested: string[] = [];
    await page.route("**/api/v1/**", async route => {
        const path = new URL(route.request().url()).pathname.replace(/\/$/, "");
        requested.push(path);
        let body: unknown = [];
        if (path === "/api/v1/users/me") body = { id: 1, email: "owner@example.test", full_name: "Usuario de prueba", role_id: readOnly ? 3 : 1, role: { id: readOnly ? 3 : 1, name: readOnly ? "viewer" : "admin" }, company_id: 1, is_active: true, can_view_finance: false };
        else if (path === "/api/v1/organization/access") body = permissions;
        else if (path === "/api/v1/organization/members") body = members;
        else if (path === "/api/v1/organization/members/20") { writes.push(route.request().postDataJSON()); body = members[0]; }
        else if (path === "/api/v1/organization/departments") body = departments;
        else if (path === "/api/v1/organization/teams") body = [{ id: 3, name: "Equipo de prueba", code: "T", department_id: 1, is_active: true, usage: { active_member_assignments: 0, can_delete: true, can_deactivate: true } }];
        else if (path === "/api/v1/organization/permission-profiles") body = profiles;
        else if (path === "/api/v1/organization/permission-definitions") body = [
            { id: 1, code: "access.members.manage", category: "access", is_system_only: true, recommended_for: ["company_administrators"] },
            { id: 2, code: "access.members.read", category: "access", is_system_only: false, recommended_for: [] },
        ];
        else if (path === "/api/v1/locations") body = [{ id: 5, name: "Ubicación de prueba", is_active: true }];
        else if (path.includes("entitlements")) body = { entitlements: ["organization", "teams", "locations"].map(name => ({ code: `features.${name}`, value_type: "boolean", value: true })) };
        else if (path === "/api/v1/companies/1") body = { id: 1, name: "Prueba", onboarding_completed: true, subscription_status: "active" };
        else if (path.includes("alert-count")) body = { pending_requests: 0, pending_tasks: 0, unread_reports: 0 };
        await route.fulfill({ json: body });
    });
    return { writes, requested };
}

test("owner navigates all tabs and preserves unchanged profile assignments without replacing them", async ({ page }, testInfo) => {
    test.setTimeout(90_000);
    const { writes } = await fixture(page);
    const errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.goto("/dashboard/organization");
    await expect(page.getByRole("tab")).toHaveCount(4);
    await expect(page.getByRole("combobox").last()).toContainText("20");
    for (const label of [/Departamentos/, /Equipos/, /Perfiles/]) await page.getByRole("tab", { name: label }).click();
    await page.getByRole("row", { name: /Editar Comercial/ }).click();
    await expect(page.getByRole("dialog")).toContainText("no cambiando tus propios permisos de administrador");
    await expect(page.getByText("No delegable a este perfil")).toBeVisible();
    await expect(page.locator("#definition-1")).toBeDisabled();
    await expect(page.locator("#definition-2")).toBeEnabled();
    await page.screenshot({ path: testInfo.outputPath("profile-permissions.png") });
    await page.keyboard.press("Escape");
    await page.getByRole("tab", { name: /Personas/ }).click();
    await page.getByRole("row", { name: /Persona de prueba/ }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByRole("combobox", { name: /Ámbito de Comercial/ })).toHaveCount(2);
    await expect(dialog).toContainText("Ubicación de prueba");
    await expect(dialog).toContainText("Equipo de prueba");
    await page.screenshot({ path: testInfo.outputPath("member-scopes.png") });
    await dialog.getByRole("button", { name: /Guardar/ }).click();
    await expect(dialog).toHaveCount(0);
    expect(writes).toHaveLength(1);
    expect(writes[0]).toEqual({ access_class: "responsible", status: "active", department_ids: [], team_ids: [] });
    expect(errors).toEqual([]);
});

test("a reader only loads the permitted tab and cannot open its editor", async ({ page }) => {
    const { requested } = await fixture(page, true);
    await page.goto("/dashboard/organization");
    await expect(page.getByRole("tab")).toHaveCount(1);
    await expect(page.getByRole("tab", { name: /Departamentos/ })).toBeVisible();
    await expect(page.locator('a[href="/dashboard/organization"]')).toBeVisible();
    await expect(page.getByRole("button", { name: /Añadir departamento/ })).toBeDisabled();
    await expect(page.getByText("Operaciones de prueba").first()).toBeVisible();
    await expect(page.getByRole("button", { name: /Acciones.*Operaciones de prueba/ })).toHaveCount(0);
    expect(requested).not.toContain("/api/v1/organization/members");
    expect(requested).not.toContain("/api/v1/organization/teams");
    expect(requested).not.toContain("/api/v1/organization/permission-profiles");
});

for (const width of [1440, 768, 390]) {
    test(`new teams can clear an optional department before saving at ${width}px`, async ({ page }) => {
        await page.setViewportSize({ width, height: 1000 });
        await fixture(page);
        let created: Record<string, unknown> | undefined;
        await page.route("**/api/v1/organization/teams", async route => {
            if (route.request().method() !== "POST") return route.fallback();
            created = route.request().postDataJSON();
            await route.fulfill({ json: { id: 8, ...created, is_active: true } });
        });
        await page.goto("/dashboard/organization");
        await selectSection(page, page, /Equipos/i);
        await page.getByRole("button", { name: "Añadir equipo", exact: true }).click();
        const dialog = page.getByRole("dialog", { name: "Nuevo equipo", exact: true });
        await dialog.getByLabel("Nombre", { exact: true }).fill("Equipo QA sin departamento");
        await dialog.getByRole("combobox").click();
        await page.getByRole("option", { name: "Operaciones de prueba", exact: true }).click();
        await dialog.getByRole("combobox").click();
        await page.getByRole("option", { name: "Sin departamento", exact: true }).click();
        await dialog.getByRole("button", { name: "Guardar", exact: true }).click();
        await expect(dialog).toHaveCount(0);
        expect(created).toEqual({ name: "Equipo QA sin departamento" });
    });
}
