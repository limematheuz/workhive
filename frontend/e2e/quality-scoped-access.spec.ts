import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import { qualityAccessFixture } from "./helpers/quality-access";
import { selectSection } from "./helpers/select-section";

const sections = [
    { id: "templates", label: "Plantillas", record: { id: 1, title: "QA plantilla visible", location_id: 15, is_active: true, items: [] } },
    { id: "inspections", label: "Inspecciones", record: { id: 1, template_title: "QA inspección visible", location_id: 15, status: "completed", score: 1, max_score: 1, items: [], evidence: [] } },
    { id: "incidents", label: "Incidencias", record: { id: 2, title: "QA incidencia visible", location_id: 15, status: "open", created_at: "2026-11-01T12:00:00Z", corrective_actions: [], evidence: [] } },
    { id: "complaints", label: "Reclamaciones", record: { id: 1, title: "QA reclamación visible", location_id: 15, status: "submitted", source: "internal", description: "QA", created_at: "2026-11-01T12:00:00Z" } },
];

for (const width of [1440, 768, 390]) for (const section of sections) {
    test(`quality only ${section.id} loads authorized records at ${width}px`, async ({ context, page }) => {
        test.skip(process.env.E2E_BASE_URL !== "http://localhost:3000", "Local UI regression only");
        await page.setViewportSize({ width, height: 1000 });
        const token = Buffer.from(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600 })).toString("base64url");
        await context.addCookies([{ name: "auth_token", value: `fixture.${token}.not-a-backend-token`, url: "http://localhost:3000" }]);
        await page.addInitScript(() => localStorage.setItem("locale", "es"));
        const reads: string[] = [];
        const denied: string[] = [];
        let backgroundLocationReads = 0;
        await page.route("**/api/v1/**", async route => {
            const path = new URL(route.request().url()).pathname.replace(/\/$/, "");
            let body: unknown = [];
            if (path === "/api/v1/users/me") body = { id: 1, full_name: "QA lector", role: { name: "viewer" }, company_id: 1, is_active: true, can_view_quality: true, can_manage_quality: false };
            else if (path === "/api/v1/companies/1") body = { id: 1, name: "QA", onboarding_completed: true, subscription_status: "active" };
            else if (path.endsWith("organization/access")) body = { [`quality.${section.id}.read`]: true };
            else if (path === "/api/v1/quality/access") body = qualityAccessFixture({ [`quality.${section.id}.read`]: true });
            else if (path === "/api/v1/locations") {
                // The shared notification panel performs one independent lookup.
                backgroundLocationReads++;
                await route.fulfill({ status: 403, json: { detail: "Not enough permissions" } });
                return;
            } else if (path.startsWith("/api/v1/quality/")) {
                reads.push(path);
                if (path !== `/api/v1/quality/${section.id}`) {
                    denied.push(path);
                    await route.fulfill({ status: 403, json: { detail: "Not enough permissions" } });
                    return;
                }
                body = [section.record];
            }
            await route.fulfill({ json: body });
        });
        await page.goto("/dashboard/quality");
        await expect(page.getByRole("banner").getByRole("heading", { name: "Calidad", exact: true })).toBeVisible();
        const title = section.record.title ?? section.record.template_title;
        if (!title) throw new Error("Missing fixture title");
        await expect(page.getByText(title, { exact: true }).filter({ visible: true })).toBeVisible();
        expect(denied).toEqual([]);
        expect(reads).toEqual([`/api/v1/quality/${section.id}`]);
        expect(backgroundLocationReads).toBe(1);
        await expect(page.getByRole("table").filter({ visible: true })).toHaveCount(width >= 1024 ? 1 : 0);
        for (const other of sections.filter(item => item.id !== section.id)) {
            await expect(page.getByRole("tab", { name: other.label, exact: true })).toHaveCount(0);
        }
        await expect(page.getByRole("button", { name: /^Nueva / }).filter({ visible: true })).toHaveCount(0);
        await expect(page.getByRole("button", { name: "Organización", exact: true })).toHaveCount(0);
    });
}

async function setupScenario(context: BrowserContext, page: Page, capabilities: Record<string, boolean>, failFirst = false) {
    const token = Buffer.from(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600 })).toString("base64url");
    await context.addCookies([{ name: "auth_token", value: `fixture.${token}.not-a-backend-token`, url: "http://localhost:3000" }]);
    await page.addInitScript(() => localStorage.setItem("locale", "es"));
    const reads: string[] = [];
    const denied: string[] = [];
    await page.route("**/api/v1/**", async route => {
        const path = new URL(route.request().url()).pathname.replace(/\/$/, "");
        let body: unknown = [];
        if (path === "/api/v1/users/me") body = { id: 1, full_name: "QA", role: { name: "admin" }, company_id: 1, is_active: true, can_view_quality: true, can_manage_quality: true };
        else if (path === "/api/v1/companies/1") body = { id: 1, name: "QA", onboarding_completed: true, subscription_status: "active" };
        else if (path.endsWith("organization/access")) body = capabilities;
        else if (path === "/api/v1/quality/access") body = qualityAccessFixture(capabilities);
        else if (path.startsWith("/api/v1/quality/")) {
            reads.push(path);
            const section = path.split("/")[4];
            if (!capabilities[`quality.${section}.read`] || route.request().method() !== "GET") {
                denied.push(path);
                await route.fulfill({ status: 403, json: { detail: "Not enough permissions" } });
                return;
            }
            if (failFirst) {
                failFirst = false;
                await route.fulfill({ status: 503, json: { detail: "Private server detail" } });
                return;
            }
            body = [sections.find(item => item.id === section)!.record];
        }
        await route.fulfill({ json: body });
    });
    return { reads, denied };
}

test("quality management in another section does not enable incident writes", async ({ context, page }) => {
    test.skip(process.env.E2E_BASE_URL !== "http://localhost:3000", "Local UI regression only");
    const { denied } = await setupScenario(context, page, { "quality.templates.read": true, "quality.templates.manage": true, "quality.incidents.read": true });
    await page.goto("/dashboard/quality");
    await selectSection(page, page, "Incidencias");
    await expect(page.getByRole("button", { name: "Nueva incidencia", exact: true })).toHaveCount(0);
    await page.getByText("QA incidencia visible", { exact: true }).filter({ visible: true }).click();
    const dialog = page.getByRole("dialog", { name: "Acciones correctivas", exact: true });
    await expect(dialog.getByRole("combobox", { name: "Estado de la incidencia", exact: true })).toHaveCount(0);
    await expect(dialog.getByRole("button", { name: "Añadir acción", exact: true })).toHaveCount(0);
    await expect(dialog.getByRole("button", { name: "Añadir foto", exact: true })).toHaveCount(0);
    expect(denied).toEqual([]);
});

test("quality reload after revocation clears records despite stale aggregate permissions", async ({ context, page }) => {
    test.skip(process.env.E2E_BASE_URL !== "http://localhost:3000", "Local UI regression only");
    const capabilities = { "quality.incidents.read": true };
    const { reads, denied } = await setupScenario(context, page, capabilities);
    await page.goto("/dashboard/quality");
    await expect(page.getByText("QA incidencia visible", { exact: true }).filter({ visible: true })).toBeVisible();
    const readCount = reads.length;
    capabilities["quality.incidents.read"] = false;
    await page.reload();
    await expect(page.getByRole("heading", { name: "Calidad restringida", exact: true })).toBeVisible();
    await expect(page.getByText("QA incidencia visible", { exact: true })).toHaveCount(0);
    expect(reads).toHaveLength(readCount);
    expect(denied).toEqual([]);
});

test("quality load failure offers retry instead of an empty record list", async ({ context, page }) => {
    test.skip(process.env.E2E_BASE_URL !== "http://localhost:3000", "Local UI regression only");
    const { reads, denied } = await setupScenario(context, page, { "quality.incidents.read": true }, true);
    await page.goto("/dashboard/quality");
    await expect(page.getByRole("heading", { name: "No se pudo cargar Calidad", exact: true })).toBeVisible();
    await expect(page.getByText("No hay incidencias abiertas.", { exact: true })).toHaveCount(0);
    await expect(page.getByText("Private server detail", { exact: true })).toHaveCount(0);
    await page.getByRole("button", { name: "Reintentar", exact: true }).click();
    await expect(page.getByText("QA incidencia visible", { exact: true }).filter({ visible: true })).toBeVisible();
    expect(reads).toEqual(["/api/v1/quality/incidents", "/api/v1/quality/incidents"]);
    expect(denied).toEqual([]);
});

for (const width of [1440, 768, 390]) test(`quality company reading and local management at ${width}px`, async ({ context, page }) => {
    test.skip(process.env.E2E_BASE_URL !== "http://localhost:3000", "Local UI regression only");
    await page.setViewportSize({ width, height: 1000 });
    const token = Buffer.from(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600 })).toString("base64url");
    await context.addCookies([{ name: "auth_token", value: `fixture.${token}.not-a-backend-token`, url: "http://localhost:3000" }]);
    await page.addInitScript(() => localStorage.setItem("locale", "es"));
    const capabilities = { "quality.incidents.read": true, "quality.incidents.manage": true, "quality.templates.read": true, "quality.templates.manage": true };
    const writes: string[] = [];
    await page.route("**/api/v1/**", async route => {
        const path = new URL(route.request().url()).pathname.replace(/\/$/, "");
        let body: unknown = [];
        if (path.endsWith("users/me")) body = { id: 1, full_name: "QA local", role: { name: "viewer" }, company_id: 1, is_active: true, can_view_quality: true, can_manage_quality: true };
        else if (path.endsWith("companies/1")) body = { id: 1, name: "QA", onboarding_completed: true, subscription_status: "active" };
        else if (path.endsWith("organization/access")) body = capabilities;
        else if (path.endsWith("quality/access")) {
            const access = qualityAccessFixture(capabilities);
            access.sections.incidents.manage_locations = [15];
            access.sections.templates.manage_locations = [15];
            body = access;
        } else if (path.endsWith("quality/incidents")) body = [15, 16].map(id => ({ ...sections[2].record, id, title: `QA sede ${id}`, location_id: id }));
        if (route.request().method() !== "GET") {
            writes.push(path);
            await route.fulfill({ status: 403, json: { detail: "Not enough permissions" } });
        } else await route.fulfill({ json: body });
    });
    await page.goto("/dashboard/quality");
    await page.getByRole("button", { name: "Nueva plantilla", exact: true }).click();
    const template = page.getByRole("dialog", { name: "Nueva plantilla de inspección", exact: true });
    const titleRects = await template.getByRole("heading", { name: "Nueva plantilla de inspección", exact: true }).evaluate(element => {
        const range = document.createRange();
        range.selectNodeContents(element);
        return Array.from(range.getClientRects(), rect => ({ left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom }));
    });
    const close = await template.getByRole("button", { name: "Close", exact: true }).boundingBox();
    if (!close) throw new Error("Missing close control");
    expect(titleRects.every(rect => rect.right <= close.x || rect.bottom <= close.y || rect.top >= close.y + close.height)).toBe(true);
    await template.getByRole("combobox", { name: "Ubicación", exact: true }).click();
    await expect(page.getByRole("option", { name: "Toda la empresa", exact: true })).toHaveCount(0);
    await expect(page.getByRole("option", { name: "Ubicación #15", exact: true })).toBeVisible();
    await expect(page.getByRole("option", { name: "Ubicación #16", exact: true })).toHaveCount(0);
    await page.keyboard.press("Escape");
    await template.getByRole("button", { name: "Cancelar", exact: true }).click();
    await selectSection(page, page, "Incidencias");
    for (const id of [15, 16]) {
        await page.getByText(`QA sede ${id}`, { exact: true }).filter({ visible: true }).click();
        const dialog = page.getByRole("dialog", { name: "Acciones correctivas", exact: true });
        await expect(dialog.getByRole("combobox", { name: "Estado de la incidencia", exact: true })).toHaveCount(id === 15 ? 1 : 0);
        await expect(dialog.getByRole("button", { name: "Añadir acción", exact: true })).toHaveCount(id === 15 ? 1 : 0);
        await expect(dialog.getByRole("button", { name: "Añadir foto", exact: true })).toHaveCount(id === 15 ? 1 : 0);
        await dialog.getByRole("button", { name: "Cerrar", exact: true }).click();
    }
    expect(writes).toEqual([]);
});
