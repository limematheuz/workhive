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
        localStorage.setItem("locale", value);
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

async function clickAnalyticsTab(page: Page, label: string) {
    const tab = page.getByRole("tab", { name: label, exact: true });
    if (await tab.isVisible()) {
        await tab.click();
        return;
    }
    await page.getByRole("combobox", { name: "Seleccionar sección", exact: true }).click();
    await page.getByRole("option", { name: label, exact: true }).click();
}

for (const width of [1440, 768, 390]) {
    test(`analytics finance, entitlements, and client profitability recover from 503 and isolate 403/periods at ${width}px`, async ({ page }) => {
        test.skip(process.env.E2E_BASE_URL !== "http://localhost:3000", "Local UI regression only");
        await page.setViewportSize({ width, height: 900 });
        await setupAuthAndLocale(page, "es");

        let entitlementsMode: "503" | "ok" = "503";
        let financeMode: "503" | "ok" | "403" = "503";
        let profitabilityMonthMode: "503" | "ok" | "403" = "503";
        let profitabilityYearMode: "503" | "ok" | "403" = "503";
        let financeCalls = 0;

        const nowIso = new Date().toISOString().slice(0, 10);

        await page.route("**/api/v1/**", async (route) => {
            const url = new URL(route.request().url());
            const path = url.pathname.replace(/\/$/, "");
            if (path === "/api/v1/users/me") {
                return route.fulfill({
                    json: {
                        id: 41,
                        full_name: "Admin Analítica",
                        role: { name: "admin" },
                        company_id: 1,
                        is_active: true,
                        can_view_finance: true,
                        can_manage_finance: true,
                        can_view_labor_costs: true,
                        can_manage_labor_costs: true,
                    },
                });
            }
            if (path === "/api/v1/companies/1") {
                return route.fulfill({
                    json: { id: 1, name: "Empresa QA", onboarding_completed: true, subscription_status: "active" },
                });
            }
            if (path === "/api/v1/companies/current/entitlements") {
                if (entitlementsMode === "503") return route.fulfill({ status: 503, json: { detail: "Unavailable" } });
                return route.fulfill({
                    json: {
                        entitlements: [
                            { code: "features.invoices", value_type: "boolean", value: true },
                            { code: "features.profitability", value_type: "boolean", value: true },
                            { code: "features.accountant_portal", value_type: "boolean", value: true },
                        ],
                    },
                });
            }
            if (path === "/api/v1/sales-ledger") {
                financeCalls += 1;
                if (financeMode === "503") return route.fulfill({ status: 503, json: { detail: "Unavailable" } });
                if (financeMode === "403") return route.fulfill({ status: 403, json: { detail: "Forbidden" } });
                return route.fulfill({
                    json: [
                        {
                            source_type: "manual",
                            source_id: 1,
                            document_number: "MAN-2026-0001",
                            entry_date: nowIso,
                            client_name: "Cliente QA",
                            base_amount: 1000,
                            tax_amount: 210,
                            total_amount: 1210,
                            payment_status: "paid",
                            invoice_status: "issued",
                            is_rectification: false,
                            collected_amount: 1210,
                            is_editable: false,
                        },
                    ],
                });
            }
            if (path === "/api/v1/invoices") {
                if (financeMode === "503") return route.fulfill({ status: 503, json: { detail: "Unavailable" } });
                if (financeMode === "403") return route.fulfill({ status: 403, json: { detail: "Forbidden" } });
                return route.fulfill({ json: [] });
            }
            if (path === "/api/v1/expenses") {
                if (financeMode === "503") return route.fulfill({ status: 503, json: { detail: "Unavailable" } });
                if (financeMode === "403") return route.fulfill({ status: 403, json: { detail: "Forbidden" } });
                return route.fulfill({
                    json: [
                        {
                            id: 1,
                            expense_date: nowIso,
                            description: "Gasto QA",
                            vendor: "Proveedor",
                            category: "supplies",
                            base_amount: 200,
                            tax_amount: 42,
                            total_amount: 242,
                            is_active: true,
                        },
                    ],
                });
            }
            if (path === "/api/v1/client-profitability") {
                const period = url.searchParams.get("period") || "month";
                const mode = period === "year" ? profitabilityYearMode : profitabilityMonthMode;
                if (mode === "503") return route.fulfill({ status: 503, json: { detail: "Unavailable" } });
                if (mode === "403") return route.fulfill({ status: 403, json: { detail: "Forbidden" } });
                const label = period === "year" ? "Cliente Año QA" : "Cliente Mes QA";
                const margin = period === "year" ? 950 : 500;
                const summary = {
                    revenue_base_amount: 1000,
                    direct_cost_base_amount: 1000 - margin,
                    known_margin_amount: margin,
                    known_margin_percentage: 50,
                    client_count: 1,
                    unassigned_expense_base_amount: 0,
                    unassigned_material_cost_base_amount: 0,
                    unlinked_historical_sales_base_amount: 0,
                    clients: [
                        {
                            client_id: 1,
                            client_name: label,
                            invoice_count: 1,
                            direct_cost_count: 1,
                            revenue_base_amount: 1000,
                            direct_cost_base_amount: 1000 - margin,
                            known_margin_amount: margin,
                            known_margin_percentage: 50,
                        },
                    ],
                };
                return route.fulfill({ json: { period, reference_date: nowIso, current: summary, previous: summary } });
            }
            if (path.includes("alert-count")) return route.fulfill({ json: { pending_requests: 0, pending_tasks: 0, unread_reports: 0 } });
            return route.fulfill({ json: [] });
        });

        await page.goto("/dashboard/analytics");
        const main = page.locator("main");
        const alert = main.getByRole("alert").first();

        // Initial 503 on finance/entitlements must NOT render fake 0,00 € KPI cards
        await expect(alert).toBeVisible();
        await expect(alert.getByRole("button", { name: "Reintentar", exact: true })).toBeVisible();
        await expect(main.getByText("0,00 €")).toHaveCount(0);
        await expect(main.getByText("Todavía no hay datos financieros suficientes.")).toHaveCount(0);
        await expectNoHorizontalOverflow(page);

        // Live ES <-> EN translation updates alert without firing extra fetches
        const callsBeforeLocale = financeCalls;
        await switchLocaleDesktop(page, "en");
        await expect(main.getByRole("button", { name: "Retry", exact: true })).toBeVisible();
        await switchLocaleDesktop(page, "es");
        await expect(main.getByRole("button", { name: "Reintentar", exact: true })).toBeVisible();
        expect(financeCalls).toBe(callsBeforeLocale);

        // Retry recovers both finance numbers and entitlement tabs
        entitlementsMode = "ok";
        financeMode = "ok";
        await alert.getByRole("button", { name: "Reintentar", exact: true }).click();
        await expect(main.getByText("1000,00 €").filter({ visible: true }).first()).toBeVisible();
        await expect(main.getByText("800,00 €").filter({ visible: true }).first()).toBeVisible();

        // Profitability tab 503 must NOT show false empty text
        await clickAnalyticsTab(page, "Rentabilidad");
        await expect(main.getByText("No hay actividad facturable de clientes en este periodo.")).toHaveCount(0);
        await expect(main.getByRole("alert")).toContainText("No se pudo cargar la rentabilidad por cliente.");
        await expect(main.getByRole("button", { name: "Reintentar", exact: true })).toBeVisible();

        // Retry profitability loads month snapshot
        profitabilityMonthMode = "ok";
        await main.getByRole("button", { name: "Reintentar", exact: true }).click();
        await expect(main.getByText("Cliente Mes QA").filter({ visible: true }).first()).toBeVisible();
        await expect(main.getByText("500,00 €").filter({ visible: true }).first()).toBeVisible();

        // Switching period to Año while 503 clears month snapshot immediately
        profitabilityYearMode = "503";
        await main.getByRole("button", { name: "Año", exact: true }).click();
        await expect(main.getByText("Cliente Mes QA")).toHaveCount(0);
        await expect(main.getByRole("alert")).toContainText("No se pudo cargar la rentabilidad por cliente.");
        await expect(main.getByRole("button", { name: "Reintentar", exact: true })).toBeVisible();

        // Retry with 403 withdraws profitability snapshot without Retry button
        profitabilityYearMode = "403";
        await main.getByRole("button", { name: "Reintentar", exact: true }).click();
        await expect(main.getByText("Cliente Mes QA")).toHaveCount(0);
        await expect(main.getByRole("alert")).toBeVisible();
        await expect(main.getByRole("button", { name: /Reintentar|Retry/i })).toHaveCount(0);
    });

    test(`operational margin catalogs, subpanels, and bank reconciliation recover cleanly at ${width}px`, async ({ page }) => {
        test.skip(process.env.E2E_BASE_URL !== "http://localhost:3000", "Local UI regression only");
        await page.setViewportSize({ width, height: 900 });
        await setupAuthAndLocale(page, "es");

        let catalogMode: "503" | "ok" = "503";
        let locationMarginMode: "503" | "ok" = "503";
        const serviceMarginMode: "503" | "403" = "403";
        let contractMarginMode: "503" | "ok" = "503";
        let bankMode: "503" | "ok" | "403" = "503";

        await page.route("**/api/v1/**", async (route) => {
            const path = new URL(route.request().url()).pathname.replace(/\/$/, "");
            if (path === "/api/v1/users/me") {
                return route.fulfill({
                    json: {
                        id: 42,
                        full_name: "Admin Margen",
                        role: { name: "admin" },
                        company_id: 1,
                        is_active: true,
                        can_view_finance: true,
                        can_manage_finance: true,
                        can_view_labor_costs: true,
                        can_manage_labor_costs: true,
                    },
                });
            }
            if (path === "/api/v1/companies/1") {
                return route.fulfill({
                    json: { id: 1, name: "Empresa QA", onboarding_completed: true, subscription_status: "active" },
                });
            }
            if (path === "/api/v1/companies/current/entitlements") {
                return route.fulfill({
                    json: { entitlements: [{ code: "features.profitability", value_type: "boolean", value: true }] },
                });
            }
            if (path === "/api/v1/service-contracts") {
                if (catalogMode === "503") return route.fulfill({ status: 503, json: { detail: "Unavailable" } });
                return route.fulfill({ json: [{ id: 1, contract_number: "CON-2026-0001", title: "Contrato QA", status: "active" }] });
            }
            if (path === "/api/v1/work-orders") {
                if (catalogMode === "503") return route.fulfill({ status: 503, json: { detail: "Unavailable" } });
                return route.fulfill({ json: [{ id: 1, title: "Orden QA", status: "completed" }] });
            }
            if (path === "/api/v1/locations") {
                if (catalogMode === "503") return route.fulfill({ status: 503, json: { detail: "Unavailable" } });
                return route.fulfill({ json: [{ id: 1, name: "Ubicación Margen QA", is_active: true }] });
            }
            if (path === "/api/v1/margin-forecasts/services") {
                if (catalogMode === "503") return route.fulfill({ status: 503, json: { detail: "Unavailable" } });
                return route.fulfill({ json: [{ id: 1, name: "Limpieza QA", version: 1 }] });
            }
            if (path === "/api/v1/margin-forecasts/teams") {
                if (catalogMode === "503") return route.fulfill({ status: 503, json: { detail: "Unavailable" } });
                return route.fulfill({ json: [] });
            }
            if (path === "/api/v1/margin-forecasts/contracts/1") {
                if (contractMarginMode === "503") return route.fulfill({ status: 503, json: { detail: "Unavailable" } });
                return route.fulfill({
                    json: {
                        scope_type: "contract", scope_id: 1, scope_name: "Contrato QA", budget: null,
                        planned_revenue_base_amount: 100, planned_direct_cost_base_amount: null, planned_margin_base_amount: null,
                        actual_revenue_base_amount: 50, actual_labor_cost_base_amount: 10, actual_material_cost_base_amount: 0,
                        actual_expense_cost_base_amount: 0, actual_direct_cost_base_amount: 10, actual_margin_base_amount: 40,
                        direct_cost_variance_base_amount: null,
                    },
                });
            }
            if (path === "/api/v1/margin-forecasts/locations/1") {
                if (locationMarginMode === "503") return route.fulfill({ status: 503, json: { detail: "Unavailable" } });
                return route.fulfill({
                    json: {
                        location_id: 1, location_name: "Ubicación Margen QA",
                        actual_revenue_base_amount: 1200, actual_labor_cost_base_amount: 200,
                        actual_material_cost_base_amount: 0, actual_expense_cost_base_amount: 0,
                        actual_direct_cost_base_amount: 200, actual_margin_base_amount: 1000,
                    },
                });
            }
            if (path === "/api/v1/margin-forecasts/services/1") {
                if (serviceMarginMode === "403") return route.fulfill({ status: 403, json: { detail: "Forbidden" } });
                return route.fulfill({ status: 503, json: { detail: "Unavailable" } });
            }
            if (path === "/api/v1/bank-reconciliation/entries") {
                if (bankMode === "503") return route.fulfill({ status: 503, json: { detail: "Unavailable" } });
                if (bankMode === "403") return route.fulfill({ status: 403, json: { detail: "Forbidden" } });
                return route.fulfill({
                    json: [
                        {
                            id: 10,
                            booked_at: "2026-11-14T10:00:00Z",
                            amount: 54.45,
                            currency: "EUR",
                            account_label: "Banco QA",
                            external_id: "EXT-10",
                            reference: "APUNTE-QA-10",
                            counterparty: "Cliente Banco QA",
                            notes: null,
                            status: "unmatched",
                            created_by_user_id: 42,
                            created_at: "2026-11-14T10:00:00Z",
                            current_reconciliation: null,
                        },
                    ],
                });
            }
            if (path.includes("alert-count")) return route.fulfill({ json: { pending_requests: 0, pending_tasks: 0, unread_reports: 0 } });
            return route.fulfill({ json: [] });
        });

        await page.goto("/dashboard/analytics");
        const main = page.locator("main");

        // Operational Margin catalog 503 must NOT show false empty text
        await clickAnalyticsTab(page, "Margen operativo");
        await expect(main.getByText("No hay elementos disponibles para este alcance.")).toHaveCount(0);
        await expect(main.getByRole("alert")).toContainText("No se pudieron cargar los alcances operativos.");
        await expect(main.getByRole("button", { name: "Reintentar", exact: true })).toBeVisible();

        // Recover catalogs, then verify MarginForecastPanel 503 -> Retry -> ok
        catalogMode = "ok";
        await main.getByRole("button", { name: "Reintentar", exact: true }).click();
        await expect(main.getByRole("alert")).toContainText("No se pudo cargar el margen previsto");
        await expect(main.getByRole("button", { name: "Reintentar", exact: true })).toBeVisible();

        contractMarginMode = "ok";
        await main.getByRole("button", { name: "Reintentar", exact: true }).click();
        await expect(main.getByText("40,00 €").filter({ visible: true }).first()).toBeVisible();

        // Location subpanel 503 -> Retry -> ok
        await main.getByRole("combobox", { name: "Alcance de margen", exact: true }).click();
        await page.getByRole("option", { name: "Ubicación", exact: true }).click();
        await expect(main.getByRole("alert")).toContainText("No se pudo cargar el margen de la ubicación.");
        locationMarginMode = "ok";
        await main.getByRole("button", { name: "Reintentar", exact: true }).click();
        await expect(main.getByText("1200,00 €").filter({ visible: true }).first()).toBeVisible();

        // Service subpanel 403 -> denied alert without Retry button
        await main.getByRole("combobox", { name: "Alcance de margen", exact: true }).click();
        await page.getByRole("option", { name: "Servicio", exact: true }).click();
        await expect(main.getByRole("alert")).toBeVisible();
        await expect(main.getByRole("button", { name: /Reintentar|Retry/i })).toHaveCount(0);

        // Bank reconciliation 503 must NOT show false empty state; Retry recovers; 403 clears without Retry
        await clickAnalyticsTab(page, "Conciliación");
        await expect(main.getByText("Todavía no hay apuntes bancarios registrados.")).toHaveCount(0);
        await expect(main.getByRole("alert")).toContainText("No se pudieron cargar los apuntes bancarios.");
        await expect(main.getByRole("button", { name: "Reintentar", exact: true })).toBeVisible();

        bankMode = "ok";
        await main.getByRole("button", { name: "Reintentar", exact: true }).click();
        await expect(main.getByText("Cliente Banco QA").filter({ visible: true }).first()).toBeVisible();

        bankMode = "403";
        await page.evaluate(() => {
            window.dispatchEvent(new CustomEvent("workhive:realtime-invalidation", { detail: ["dashboard"] }));
        });
        await expect(main.getByText("Cliente Banco QA")).toHaveCount(0);
        await expect(main.getByRole("alert")).toBeVisible();
        await expect(main.getByRole("button", { name: /Reintentar|Retry/i })).toHaveCount(0);
        await expectNoHorizontalOverflow(page);
    });
}

for (const width of [390, 1440]) test(`finance remains usable when a custom plan excludes invoices at ${width}px`, async ({ page }) => {
    test.skip(process.env.E2E_BASE_URL !== "http://localhost:3000", "Local UI regression only");
    await page.setViewportSize({ width, height: 900 });
    await setupAuthAndLocale(page);
    const forbiddenReads: string[] = [];
    const now = new Date().toISOString().slice(0, 10);
    await page.route("**/api/v1/**", async route => {
        const path = new URL(route.request().url()).pathname.replace(/\/$/, "");
        if (path === "/api/v1/users/me") return route.fulfill({ json: {
            id: 41, full_name: "Finanzas QA", company_id: 1, role: { name: "viewer" },
            is_active: true, can_view_finance: true, can_manage_finance: false,
        } });
        if (path === "/api/v1/companies/1") return route.fulfill({ json: { id: 1, name: "QA", onboarding_completed: true, subscription_status: "active" } });
        if (path === "/api/v1/companies/current/entitlements") return route.fulfill({ json: { entitlements: [{ code: "features.invoices", value_type: "boolean", value: false }] } });
        if (path === "/api/v1/invoices" || path === "/api/v1/customer-payments") {
            forbiddenReads.push(path);
            return route.fulfill({ status: 403, json: { detail: "Module disabled" } });
        }
        if (path === "/api/v1/sales-ledger") return route.fulfill({ json: [{
            source_type: "manual", source_id: 1, document_number: "QA-MANUAL", entry_date: now,
            client_name: "Cliente QA", base_amount: 1000, tax_amount: 210, total_amount: 1210,
            payment_status: "paid", invoice_status: "issued", is_rectification: false, collected_amount: 1210,
        }] });
        if (path === "/api/v1/expenses") return route.fulfill({ json: [{
            id: 1, expense_date: now, description: "QA gasto", category: "supplies",
            base_amount: 200, tax_amount: 42, total_amount: 242, is_active: true,
        }] });
        return route.fulfill({ json: [] });
    });
    await page.goto("/dashboard/analytics");
    const main = page.locator("main");
    await expect(main.getByText("1000,00 €").filter({ visible: true }).first()).toBeVisible();
    await expect(main.getByText("800,00 €").filter({ visible: true }).first()).toBeVisible();
    expect(forbiddenReads).toEqual([]);
    await expect(main.getByRole("alert")).toHaveCount(0);
    await expectNoHorizontalOverflow(page);
});
