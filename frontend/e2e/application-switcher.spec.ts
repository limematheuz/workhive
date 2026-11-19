import { expect, test, type BrowserContext, type Page } from "@playwright/test";

const base = process.env.E2E_BASE_URL ?? "";
const accesses = [
    { key: "internal:1", kind: "internal", label: "Administración", description: "Gestiona la empresa", company_id: 1, company_name: "Empresa QA", href: "/dashboard" },
    { key: "worker:1", kind: "worker", label: "App del trabajador", description: "Tus trabajos y tu jornada", company_id: 1, company_name: "Empresa QA", href: "/worker" },
    { key: "client:7", kind: "client", label: "Portal del cliente", description: "Documentos del cliente QA", company_id: 1, company_name: "Empresa QA", href: "/portal-cliente" },
    { key: "adviser:9", kind: "adviser", label: "Portal de gestoría", description: "Área contable y laboral", company_id: 1, company_name: "Empresa QA", href: "/gestoria" },
];

async function fixture(context: BrowserContext, page: Page) {
    const state = { applications: [...accesses], current: "internal:1", guest: false, failRead: false, rejectSwitch: false, unsafeSwitch: false, reads: 0, writes: [] as { key: string }[] };
    const payload = Buffer.from(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600 })).toString("base64url");
    await context.addCookies([{ name: "auth_token", value: `fixture.${payload}.not-a-backend-token`, url: base }]);
    await page.addInitScript(() => {
        localStorage.setItem("locale", "es");
        if (!sessionStorage.getItem("application-switch-fixture-initialized")) {
            localStorage.setItem("token", "legacy-must-be-removed");
            sessionStorage.setItem("workhive_user_cache:v1", JSON.stringify({ id: 13, role: { name: "admin" }, company_id: 1 }));
            sessionStorage.setItem("application-switch-fixture-initialized", "true");
        }
    });
    await page.route("**/api/v1/**", async route => {
        const request = route.request(), path = new URL(request.url()).pathname.replace(/\/$/, "");
        if (path === "/api/v1/traffic/page-view") { await route.fulfill({ status: 204 }); return; }
        if (path === "/api/v1/auth/csrf") { await route.fulfill({ json: { csrf_token: "fixture-csrf" } }); return; }
        if (path === "/api/v1/session/applications") {
            state.reads++;
            if (state.guest) { await route.fulfill({ status: 401, json: { detail: "Not authenticated" } }); return; }
            if (state.failRead) { await route.fulfill({ status: 503, json: { detail: "Accesos temporalmente no disponibles" } }); return; }
            const current = accesses.find(row => row.key === state.current)!;
            await route.fulfill({ json: { current_application: current.kind, current_key: state.current, applications: state.applications } }); return;
        }
        if (path === "/api/v1/session/applications/switch") {
            const body = request.postDataJSON() as { key: string }; state.writes.push(body);
            if (state.rejectSwitch) {
                state.applications = state.applications.filter(row => row.key !== body.key);
                await route.fulfill({ status: 403, json: { detail: "Este acceso ya no está activo." } }); return;
            }
            const application = state.applications.find(row => row.key === body.key)!; state.current = application.key;
            await route.fulfill({ json: { application, target_path: state.unsafeSwitch ? "https://outside.example" : application.href, access_token: "must-never-be-stored", token_type: "bearer" } }); return;
        }
        if (path === "/api/v1/users/me") {
            const external = state.current.startsWith("client:");
            await route.fulfill({ json: { id: 13, full_name: "Cuenta QA", email: "cuenta@example.com", is_active: true, role: { name: external ? "client_portal" : "admin" }, company_id: external ? null : 1 } }); return;
        }
        if (path === "/api/v1/client-portal/workspaces") { await route.fulfill({ json: [] }); return; }
        await route.fulfill({ json: [] });
    });
    return state;
}

test.beforeEach(() => {
    test.skip(!/^http:\/\/(?:localhost|127\.0\.0\.1):(?:3000|3013)$/.test(base), "Local intercepted application-switching check only");
});

for (const width of [390, 1440]) test(`authorized applications retain accessible labels and company context at ${width}px`, async ({ context, page }) => {
    await page.setViewportSize({ width, height: 900 });
    const state = await fixture(context, page); state.applications = state.applications.filter(row => row.kind !== "adviser");
    await page.goto("/accesos");
    await expect(page.getByRole("heading", { name: "Elige tu espacio de trabajo", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: /^Abrir / })).toHaveCount(3);
    await expect(page.getByRole("button", { name: /Abrir Portal de gestoría/ })).toHaveCount(0);
    await expect(page.getByText("Acceso actual", { exact: true })).toHaveCount(1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect(state.writes).toEqual([]);
});

test("switching to the client portal clears the previous cached role and preserves the same identity", async ({ context, page }) => {
    const state = await fixture(context, page);
    await page.goto("/accesos");
    await page.getByRole("button", { name: "Abrir Portal del cliente · Empresa QA", exact: true }).click();
    await expect(page).toHaveURL(/\/portal-cliente$/);
    await expect(page.getByText("No tienes accesos activos", { exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Selecciona un acceso autorizado", exact: true })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Cambiar de aplicación", exact: true })).toBeVisible();
    expect(state.writes).toEqual([{ key: "client:7" }]);
    const identity = await page.evaluate(() => ({ token: localStorage.getItem("token"), user: JSON.parse(sessionStorage.getItem("workhive_user_cache:v1") ?? "null") }));
    expect(identity.token).toBeNull(); expect(identity.user.id).toBe(13); expect(identity.user.role.name).toBe("client_portal");
    expect(await page.evaluate(() => Object.values(sessionStorage).some(value => String(value).includes("must-never-be-stored")))).toBe(false);
});

test("a revoked application stays on the selector and refreshes the authorized list", async ({ context, page }) => {
    const state = await fixture(context, page); state.rejectSwitch = true;
    await page.goto("/accesos");
    await page.getByRole("button", { name: "Abrir Portal del cliente · Empresa QA", exact: true }).click();
    await expect(page.getByRole("main").getByRole("alert")).toContainText("Este acceso ya no está activo.");
    await expect(page.getByRole("button", { name: /Abrir Portal del cliente/ })).toHaveCount(0);
    await expect(page).toHaveURL(/\/accesos$/); expect(state.writes).toEqual([{ key: "client:7" }]);
});

test("load errors offer a retry without pretending that an authenticated account is a guest", async ({ context, page }) => {
    const state = await fixture(context, page); state.failRead = true;
    await page.goto("/accesos");
    await expect(page.getByRole("main").getByRole("alert")).toContainText("No se pudieron cargar tus accesos.");
    await expect(page.getByRole("link", { name: /Entrar en / })).toHaveCount(0);
    state.failRead = false;
    await page.getByRole("button", { name: "Volver a intentar", exact: true }).click();
    await expect(page.getByRole("button", { name: /^Abrir / })).toHaveCount(4); expect(state.writes).toEqual([]);
});

test("guests retain the public application entries and a login return to the selector", async ({ context, page }) => {
    const state = await fixture(context, page); state.guest = true;
    await page.goto("/accesos");
    await expect(page.getByRole("link", { name: /Entrar en / })).toHaveCount(4);
    await expect(page.getByRole("link", { name: "Entrar en Administración de la empresa", exact: true })).toHaveAttribute("href", "/login?next=/accesos");
    await expect(page.getByRole("button", { name: /^Abrir / })).toHaveCount(0); expect(state.writes).toEqual([]);
});

test("an inconsistent switch response never navigates to an untrusted destination", async ({ context, page }) => {
    const state = await fixture(context, page); state.unsafeSwitch = true;
    await page.goto("/accesos");
    await page.getByRole("button", { name: "Abrir Portal del cliente · Empresa QA", exact: true }).click();
    await expect(page.getByRole("main").getByRole("alert")).toContainText("No se pudo confirmar el acceso seleccionado");
    await expect(page).toHaveURL(/\/accesos$/); expect(state.writes).toEqual([{ key: "client:7" }]);
});
