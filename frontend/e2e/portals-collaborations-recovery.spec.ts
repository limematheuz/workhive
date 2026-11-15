import { expect, test, type Page } from "@playwright/test";

function makeToken() {
    const payload = Buffer.from(
        JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600 }),
    ).toString("base64url");
    return `fixture.${payload}.not-a-backend-token`;
}

async function expectNoHorizontalOverflow(page: Page) {
    const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth,
    );
    expect(overflow).toBe(false);
}

async function setupAuthAndLocale(page: Page, locale: "es" | "en" = "es") {
    await page.context().addCookies([
        { name: "auth_token", value: makeToken(), url: "http://localhost:3000" },
    ]);
    await page.addInitScript((value) => {
        if (!sessionStorage.getItem("qa_locale_initialized")) {
            localStorage.setItem("locale", value);
            sessionStorage.setItem("qa_locale_initialized", "1");
        }
    }, locale);
}

async function switchLocaleDesktop(page: Page, targetLocale: "en" | "es") {
    const size = page.viewportSize() ?? { width: 1440, height: 900 };
    if (size.width < 1024) {
        await page.setViewportSize({ width: 1440, height: 900 });
    }
    const label = targetLocale === "en" ? "Cambiar idioma a inglés" : "Cambiar idioma a español";
    await page.getByRole("button", { name: label, exact: true }).click();
    if (size.width < 1024) {
        await page.setViewportSize(size);
    }
}

async function selectNetworkTab(page: Page, tabName: RegExp) {
    const tab = page.getByRole("tab", { name: tabName });
    if (await tab.isVisible()) {
        await tab.click();
        return;
    }
    await page.getByRole("combobox", { name: "Sección de red externa", exact: true }).click();
    await page.getByRole("option", { name: tabName }).click();
}

for (const width of [1440, 768, 390]) {
    test(`external network operations and professionals recover from 503 and isolate 403 at ${width}px`, async ({ page }) => {
        test.skip(process.env.E2E_BASE_URL !== "http://localhost:3000", "Local UI regression only");
        await page.setViewportSize({ width, height: 900 });
        await setupAuthAndLocale(page, "es");

        let collabMode: "503" | "ok" | "403" = "503";
        let externalMode: "503" | "ok" | "403" = "503";
        let collabCalls = 0;
        let sentCalls = 0;
        let sponsoredCalls = 0;

        await page.route("**/api/v1/**", async (route) => {
            const path = new URL(route.request().url()).pathname.replace(/\/$/, "");
            if (path === "/api/v1/users/me") {
                return route.fulfill({
                    json: {
                        id: 46,
                        full_name: "Admin Red Externa",
                        email: "admin-qa@example.com",
                        role: { name: "admin" },
                        company_id: 11,
                        is_active: true,
                    },
                });
            }
            if (path === "/api/v1/companies/11") {
                return route.fulfill({
                    json: { id: 11, name: "WorkHive QA", onboarding_completed: true, subscription_status: "active" },
                });
            }
            if (path === "/api/v1/collaborations") {
                collabCalls += 1;
                if (collabMode === "503") return route.fulfill({ status: 503, json: { detail: "Unavailable" } });
                if (collabMode === "403") return route.fulfill({ status: 403, json: { detail: "Forbidden" } });
                return route.fulfill({
                    json: [
                        {
                            id: 301,
                            initiator_company_id: 11,
                            partner_company_id: 7,
                            status: "accepted",
                            role_type: "property_manager",
                            created_at: "2026-11-15T10:00:00Z",
                            updated_at: "2026-11-15T10:00:00Z",
                            initiator: { id: 11, name: "WorkHive QA", email: "admin-qa@example.com", is_active: true },
                            partner: { id: 7, name: "Partner QA Norte", email: "partner7@example.com", is_active: true },
                        },
                    ],
                });
            }
            if (path === "/api/v1/collaborations/invitations/sent") {
                sentCalls += 1;
                if (collabMode === "503") return route.fulfill({ status: 503, json: { detail: "Unavailable" } });
                if (collabMode === "403") return route.fulfill({ status: 403, json: { detail: "Forbidden" } });
                return route.fulfill({ json: [] });
            }
            if (path === "/api/v1/collaborations/sponsored-invitations/sent") {
                sponsoredCalls += 1;
                if (collabMode === "503") return route.fulfill({ status: 503, json: { detail: "Unavailable" } });
                if (collabMode === "403") return route.fulfill({ status: 403, json: { detail: "Forbidden" } });
                return route.fulfill({ json: [] });
            }
            if (path === "/api/v1/roles") {
                if (externalMode === "503") return route.fulfill({ status: 503, json: { detail: "Unavailable" } });
                if (externalMode === "403") return route.fulfill({ status: 403, json: { detail: "Forbidden" } });
                return route.fulfill({ json: [{ id: 9, name: "external_portal", description: "Gestoría" }] });
            }
            if (path === "/api/v1/users") {
                if (externalMode === "503") return route.fulfill({ status: 503, json: { detail: "Unavailable" } });
                if (externalMode === "403") return route.fulfill({ status: 403, json: { detail: "Forbidden" } });
                return route.fulfill({
                    json: [
                        {
                            id: 90,
                            email: "gestoria-qa@example.com",
                            full_name: "Gestoría QA",
                            role: { id: 9, name: "external_portal" },
                            company_id: 11,
                            is_active: true,
                        },
                    ],
                });
            }
            if (path === "/api/v1/realtime/events") {
                return route.fulfill({ status: 200, contentType: "text/event-stream", body: ": ok\n\n" });
            }
            if (path.includes("alert-count")) {
                return route.fulfill({ json: { pending_requests: 0, pending_tasks: 0, unread_reports: 0 } });
            }
            return route.fulfill({ json: [] });
        });

        await page.goto("/dashboard/external-network");
        const main = page.getByRole("main");

        // Operations 503 does not fake "no active collaborations" and renders localized ReadRecoveryBanner
        await expect(main.getByRole("alert").first()).toContainText("No se pudieron cargar las empresas colaboradoras");
        await expect(main.getByText("Todavía no hay empresas colaboradoras vinculadas.")).toHaveCount(0);
        await expectNoHorizontalOverflow(page);

        const callsBeforeLocale = { collabCalls, sentCalls, sponsoredCalls };
        await switchLocaleDesktop(page, "en");
        await expect(main.getByRole("alert").first()).toContainText("Could not load partner companies");
        expect({ collabCalls, sentCalls, sponsoredCalls }).toEqual(callsBeforeLocale);

        await switchLocaleDesktop(page, "es");
        await expect(main.getByRole("alert").first()).toContainText("No se pudieron cargar las empresas colaboradoras");
        expect({ collabCalls, sentCalls, sponsoredCalls }).toEqual(callsBeforeLocale);

        // Retry recovers active partner
        collabMode = "ok";
        await main.getByRole("button", { name: "Reintentar", exact: true }).first().click();
        await expect(main.getByText("Partner QA Norte").filter({ visible: true }).first()).toBeVisible();
        await expect(main.getByRole("alert")).toHaveCount(0);

        // Switch to Profesionales / Accesos profesionales and verify 503 -> Retry -> 403 withdrawal
        await selectNetworkTab(page, /Accesos profesionales|Profesionales/i);
        await expect(main.getByRole("alert").first()).toContainText("No se pudo cargar el acceso financiero externo.");
        await expect(main.locator("#external-access-list")).toHaveCount(0);
        await expectNoHorizontalOverflow(page);

        externalMode = "ok";
        await main.getByRole("button", { name: "Reintentar", exact: true }).click();
        await expect(main.getByText("gestoria-qa@example.com").filter({ visible: true }).first()).toBeVisible();

        externalMode = "403";
        await switchLocaleDesktop(page, "en");
        await page.goto("/dashboard/external-network?tab=professionals");
        await expect(main.getByRole("alert").first()).toContainText("You do not have permission to view external financial access.");
        await expect(main.getByRole("button", { name: /Retry|Reintentar/i })).toHaveCount(0);
        await expect(main.locator("#external-access-list")).toHaveCount(0);
    });

    test(`client portal management tab, client portal workspace, and partner portal workspace recover cleanly at ${width}px`, async ({ page }) => {
        test.skip(process.env.E2E_BASE_URL !== "http://localhost:3000", "Local UI regression only");
        await page.setViewportSize({ width, height: 900 });
        await setupAuthAndLocale(page, "es");

        let clientGrantsMode: "503" | "ok" | "403" = "503";
        let clientPortalMode: "503" | "ok" | "403" = "503";
        let partnerPortalMode: "503" | "ok" | "403" = "503";
        let currentUserRole = "admin";

        await page.route("**/api/v1/**", async (route) => {
            const path = new URL(route.request().url()).pathname.replace(/\/$/, "");
            if (path === "/api/v1/users/me") {
                return route.fulfill({
                    json: {
                        id: currentUserRole === "client_portal" ? 201 : currentUserRole === "partner_portal" ? 202 : 46,
                        full_name: "Usuario Portal QA",
                        email: `${currentUserRole}@example.com`,
                        role: { name: currentUserRole },
                        company_id: currentUserRole === "admin" ? 11 : currentUserRole === "partner_portal" ? 7 : null,
                        is_active: true,
                        can_view_clients: true,
                        can_manage_clients: true,
                    },
                });
            }
            if (path === "/api/v1/companies/11" || path === "/api/v1/companies/7") {
                return route.fulfill({
                    json: {
                        id: path.endsWith("/7") ? 7 : 11,
                        name: path.endsWith("/7") ? "Inmobiliaria QA" : "WorkHive QA",
                        onboarding_completed: true,
                        subscription_status: "active",
                    },
                });
            }
            if (path === "/api/v1/clients/access") {
                return route.fulfill({
                    json: {
                        can_read_clients: true,
                        can_manage_clients: true,
                        can_read_commercial_follow_ups: true,
                        can_manage_commercial_follow_ups: true,
                    },
                });
            }
            if (path === "/api/v1/clients") {
                return route.fulfill({
                    json: [
                        { id: 88, name: "Cliente Portal QA", email: "cliente88@example.com", city: "Girona", country: "España", is_active: true, company_id: 11, client_type: "company" },
                    ],
                });
            }
            if (path === "/api/v1/clients/88") {
                return route.fulfill({
                    json: { id: 88, name: "Cliente Portal QA", email: "cliente88@example.com", city: "Girona", country: "España", is_active: true, company_id: 11, client_type: "company", contacts: [], locations: [] },
                });
            }
            if (path === "/api/v1/client-portal/clients/88/grants" || path === "/api/v1/client-portal/clients/88/invitations") {
                if (clientGrantsMode === "503") return route.fulfill({ status: 503, json: { detail: "Unavailable" } });
                if (clientGrantsMode === "403") return route.fulfill({ status: 403, json: { detail: "Forbidden" } });
                if (path.endsWith("/grants")) {
                    return route.fulfill({
                        json: [{ id: 1, user_id: 201, email: "persona-portal@example.com", full_name: "Contacto Portal", status: "active" }],
                    });
                }
                return route.fulfill({ json: [] });
            }
            if (path === "/api/v1/client-portal/workspaces") {
                if (clientPortalMode === "503") return route.fulfill({ status: 503, json: { detail: "Unavailable" } });
                if (clientPortalMode === "403") return route.fulfill({ status: 403, json: { detail: "Forbidden" } });
                return route.fulfill({
                    json: [
                        { id: 10, company_name: "WorkHive QA", client_name: "Cliente Portal QA", status: "active" },
                    ],
                });
            }
            if (path === "/api/v1/client-portal/workspaces/10/overview") {
                if (clientPortalMode === "503") return route.fulfill({ status: 503, json: { detail: "Unavailable" } });
                if (clientPortalMode === "403") return route.fulfill({ status: 403, json: { detail: "Forbidden" } });
                return route.fulfill({
                    json: {
                        workspace: { id: 10, company_name: "WorkHive QA", client_name: "Cliente Portal QA", status: "active" },
                        summary: { quote_count: 1, active_contract_count: 0, invoice_count: 0, total_invoiced: 0, open_complaint_count: 0 },
                        quotes: [],
                        contracts: [],
                        invoices: [],
                        inspections: [],
                        complaints: [],
                        complaint_locations: [],
                    },
                });
            }
            if (path === "/api/v1/partner-portal/overview") {
                if (partnerPortalMode === "503") return route.fulfill({ status: 503, json: { detail: "Unavailable" } });
                if (partnerPortalMode === "403") return route.fulfill({ status: 403, json: { detail: "Forbidden" } });
                return route.fulfill({
                    json: {
                        host_company_name: "WorkHive QA",
                        partner_company_name: "Inmobiliaria QA",
                        location_count: 1,
                    },
                });
            }
            if (path === "/api/v1/partner-portal/locations") {
                if (partnerPortalMode === "503") return route.fulfill({ status: 503, json: { detail: "Unavailable" } });
                if (partnerPortalMode === "403") return route.fulfill({ status: 403, json: { detail: "Forbidden" } });
                return route.fulfill({
                    json: [{ id: 501, name: "Piso Costa Brava QA", is_active: true, city: "L'Escala" }],
                });
            }
            if (path === "/api/v1/partner-portal/reservations") {
                if (partnerPortalMode === "503") return route.fulfill({ status: 503, json: { detail: "Unavailable" } });
                if (partnerPortalMode === "403") return route.fulfill({ status: 403, json: { detail: "Forbidden" } });
                return route.fulfill({ json: [] });
            }
            if (path === "/api/v1/realtime/events") {
                return route.fulfill({ status: 200, contentType: "text/event-stream", body: ": ok\n\n" });
            }
            if (path.includes("alert-count")) {
                return route.fulfill({ json: { pending_requests: 0, pending_tasks: 0, unread_reports: 0 } });
            }
            return route.fulfill({ json: [] });
        });

        // 1. Admin client detail -> Portal tab recovery
        await page.goto("/dashboard/clients");
        if (width >= 1280) {
            await page.getByRole("row").filter({ hasText: "Cliente Portal QA" }).click();
        } else {
            await page.getByRole("button", { name: "Ver detalle de Cliente Portal QA", exact: true }).click();
        }
        const dialog = page.getByRole("dialog");
        const portalTab = dialog.getByRole("tab", { name: "Portal", exact: true });
        if (await portalTab.isVisible()) {
            await portalTab.click();
        } else {
            await dialog.getByRole("combobox", { name: "Seleccionar sección", exact: true }).click();
            await page.getByRole("option", { name: "Portal", exact: true }).click();
        }

        await expect(dialog.getByRole("alert")).toContainText("No se pudieron cargar los accesos del portal ahora mismo.");
        await expect(dialog.getByText("Aún no hay personas con acceso al portal.")).toHaveCount(0);
        await expectNoHorizontalOverflow(page);

        clientGrantsMode = "ok";
        await dialog.getByRole("button", { name: "Reintentar", exact: true }).click();
        await expect(dialog.getByText("persona-portal@example.com")).toBeVisible();

        clientGrantsMode = "403";
        await dialog.locator('[data-slot="dialog-close"]').click();
        if (width >= 1280) {
            await page.getByRole("row").filter({ hasText: "Cliente Portal QA" }).click();
        } else {
            await page.getByRole("button", { name: "Ver detalle de Cliente Portal QA", exact: true }).click();
        }
        const reopened = page.getByRole("dialog");
        if (await reopened.getByRole("tab", { name: "Portal", exact: true }).isVisible()) {
            await reopened.getByRole("tab", { name: "Portal", exact: true }).click();
        } else {
            await reopened.getByRole("combobox", { name: "Seleccionar sección", exact: true }).click();
            await page.getByRole("option", { name: "Portal", exact: true }).click();
        }
        await expect(reopened.getByRole("alert")).toContainText("Ya no tienes permisos");
        await expect(reopened.getByRole("button", { name: /Reintentar|Retry/i })).toHaveCount(0);

        // 2. Client portal workspace recovery & 403 revocation without Retry
        currentUserRole = "client_portal";
        await page.goto("/dashboard/client");
        const main = page.getByRole("main");
        await expect(main.getByRole("alert")).toBeVisible();
        await expectNoHorizontalOverflow(page);

        clientPortalMode = "ok";
        await main.getByRole("button", { name: "Reintentar", exact: true }).click();
        await expect(main.getByRole("heading", { name: "Cliente Portal QA" })).toBeVisible();

        clientPortalMode = "403";
        await page.reload();
        await expect(main.getByRole("alert")).toBeVisible();
        await expect(main.getByRole("button", { name: /Reintentar|Retry/i })).toHaveCount(0);

        // 3. Partner portal workspace recovery & 403 revocation without Retry
        currentUserRole = "partner_portal";
        await page.goto("/dashboard/partner");
        await expect(main.getByRole("alert")).toBeVisible();
        await expectNoHorizontalOverflow(page);

        partnerPortalMode = "ok";
        await main.getByRole("button", { name: "Reintentar", exact: true }).click();
        await expect(main.getByRole("heading", { name: "Inmobiliaria QA" })).toBeVisible();

        partnerPortalMode = "403";
        await page.reload();
        await expect(main.getByRole("alert")).toBeVisible();
        await expect(main.getByRole("button", { name: /Reintentar|Retry/i })).toHaveCount(0);
    });
}
