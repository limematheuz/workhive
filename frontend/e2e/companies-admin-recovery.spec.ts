import { expect, test } from "@playwright/test";

for (const width of [1440, 768, 390]) {
    test(`companies admin panel recovers from read failures without false empty states or stuck loading dialogs at ${width}px`, async ({ context, page }) => {
        test.skip(process.env.E2E_BASE_URL !== "http://localhost:3000", "Local intercepted UI only");
        await page.setViewportSize({ width, height: 1000 });
        const payload = Buffer.from(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600 })).toString("base64url");
        await context.addCookies([{ name: "auth_token", value: `fixture.${payload}.not-a-backend-token`, url: process.env.E2E_BASE_URL! }]);

        let failCompaniesList = true;
        let failTrialRequests = true;
        let failPlanAccess = true;
        let failPlanCatalog = false;

        const company11 = {
            id: 11,
            name: "QA Privacidad desechable 20261111",
            tax_id: "QA-PRIV-20261111",
            address: "Calle QA 11",
            phone: "600000011",
            email: "admin11@workhive.test",
            is_active: true,
            onboarding_completed: true,
            subscription_plan: "top",
            subscription_status: "active",
            trial_ends_at: null,
        };

        const entitlements = [
            { code: "limits.internal_workers", label: "Trabajadores", group: "Capacidad", value_type: "integer", value: 100, source: "plan", availability: "available" },
            { code: "features.invoices", label: "Facturación", group: "Funciones", value_type: "boolean", value: true, source: "plan", availability: "available" },
        ];

        const planAccessPayload = {
            company_id: 11,
            subscription: {
                plan_code: "top",
                plan_label: "Top",
                plan_version: 1,
                status: "active",
                is_active: true,
                started_at: "2026-11-01T10:00:00Z",
                trial_ends_at: null,
                commercial_terms: {
                    billing_interval: "monthly",
                    amount_cents: 9900,
                    currency: "EUR",
                    tax_behavior: "exclusive",
                    effective_at: "2026-11-01T10:00:00Z",
                },
            },
            entitlements,
            base_entitlements: entitlements,
            overrides: [],
            audit: [],
            usage: {
                administrators: 3,
                managers: 1,
                workers: 5,
                external_portals: 0,
                accountant_portals: 0,
                partner_portals: 0,
                departments: 1,
                teams: 1,
            },
        };

        const catalogPayload = [
            {
                code: "top",
                label: "Top",
                version: 1,
                is_active: true,
                entitlements,
            },
        ];

        await page.route("**/api/v1/**", async (route) => {
            const path = new URL(route.request().url()).pathname.replace(/\/$/, "");
            if (path === "/api/v1/users/me") {
                return route.fulfill({
                    json: {
                        id: 3,
                        full_name: "Superadmin QA",
                        email: "superadmin@workhive.test",
                        company_id: null,
                        role: { id: 4, name: "superadmin" },
                        role_id: 4,
                        is_active: true,
                    },
                });
            }
            if (path === "/api/v1/companies") {
                if (failCompaniesList) {
                    return route.fulfill({ status: 503, json: { detail: "No se han podido cargar las empresas" } });
                }
                return route.fulfill({ json: [company11] });
            }
            if (path === "/api/v1/trial-requests") {
                if (failTrialRequests) {
                    return route.fulfill({ status: 503, json: { detail: "No se han podido cargar las solicitudes de acceso." } });
                }
                return route.fulfill({ json: [] });
            }
            if (path === "/api/v1/companies/11/plan-access") {
                if (failPlanAccess) {
                    return route.fulfill({ status: 503, json: { detail: "No se ha podido cargar el plan y acceso." } });
                }
                return route.fulfill({ json: planAccessPayload });
            }
            if (path === "/api/v1/companies/plans/catalog") {
                if (failPlanCatalog) {
                    return route.fulfill({ status: 503, json: { detail: "No se ha podido cargar el catálogo de planes." } });
                }
                return route.fulfill({ json: catalogPayload });
            }
            return route.fulfill({ json: [] });
        });

        await page.goto("/dashboard/companies", { waitUntil: "domcontentloaded" });

        // 1. Neither companies list nor trial requests should render false empty states on 503
        await expect(page.getByRole("alert").filter({ hasText: "No se han podido cargar las empresas" })).toBeVisible();
        await expect(page.getByRole("alert").filter({ hasText: "No se han podido cargar las solicitudes de acceso." })).toBeVisible();
        await expect(page.getByText("Todavía no se ha activado ninguna empresa.")).toHaveCount(0);
        await expect(page.getByText("No hay solicitudes de acceso para revisar.")).toHaveCount(0);

        // Recover trial requests and companies list
        failTrialRequests = false;
        await page.getByRole("alert").filter({ hasText: "No se han podido cargar las solicitudes de acceso." }).getByRole("button", { name: "Reintentar", exact: true }).click();
        await expect(page.getByText("No hay solicitudes de acceso para revisar.")).toBeVisible();

        failCompaniesList = false;
        await page.getByRole("alert").filter({ hasText: "No se han podido cargar las empresas" }).getByRole("button", { name: "Reintentar", exact: true }).click();
        await expect(page.getByRole("button", { name: `Ver personas: ${company11.name}`, exact: true }).first()).toBeVisible();

        // 2. CompanyPlanAccessDialog should render an alert + Reintentar instead of stuck loading on 503
        await page.getByRole("button", { name: "Acciones", exact: true }).first().click();
        await page.getByRole("menuitem", { name: "Plan", exact: true }).click();
        const planAccessDialog = page.getByRole("dialog");
        await expect(planAccessDialog.getByRole("alert")).toContainText("No se ha podido cargar el plan y acceso.");
        await expect(planAccessDialog.getByLabel("Cargando plan y acceso")).toHaveCount(0);

        failPlanAccess = false;
        failPlanCatalog = false;
        await planAccessDialog.getByRole("button", { name: "Reintentar", exact: true }).click();
        await expect(planAccessDialog.getByRole("heading", { name: "Capacidad", exact: true })).toBeVisible();
        await expect(planAccessDialog.getByText("5 / 100")).toBeVisible();
        await planAccessDialog.getByRole("button", { name: "Cancelar", exact: true }).click();

        // 3. PlanCatalogEditorDialog should render an alert + Reintentar instead of stuck loading on 503
        failPlanCatalog = true;
        await page.getByRole("button", { name: "Gestionar planes", exact: true }).click();
        const catalogDialog = page.getByRole("dialog");
        await expect(catalogDialog.getByRole("alert")).toContainText("No se ha podido cargar el catálogo de planes.");
        await expect(catalogDialog.getByLabel("Cargando planes")).toHaveCount(0);

        failPlanCatalog = false;
        await catalogDialog.getByRole("button", { name: "Reintentar", exact: true }).click();
        await expect(catalogDialog.getByRole("button", { name: "Publicar nueva versión", exact: true })).toBeVisible();
    });
}
