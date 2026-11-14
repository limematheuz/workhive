import { expect, test } from "@playwright/test";

function makeToken() {
    const payload = Buffer.from(
        JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600 }),
    ).toString("base64url");
    return `fixture.${payload}.not-a-backend-token`;
}

function buildContract(overrides: Record<string, unknown> = {}) {
    return {
        id: 4,
        contract_number: "CON-2026-0001",
        title: "QA Servicio Integral v2",
        status: "active",
        company_id: 11,
        client_id: 187,
        source_quote_id: 5,
        source_quote_revision_id: 8,
        starts_at: "2026-11-14T08:00:00Z",
        ends_at: "2027-11-14T08:00:00Z",
        renewal_mode: "automatic",
        renewal_notice_days: 45,
        response_time_hours: 4,
        resolution_time_hours: 24,
        service_window: "L-V 08:00-18:00",
        notes: "Contrato QA validado",
        quote_snapshot: {
            title: "QA Servicio Integral v2",
            total_amount: 217.8,
            items: [{ description: "Limpieza técnica mensual", quantity: 2, unit_price: 100, subtotal: 200 }],
        },
        service_lines: [
            { id: 1, position: 0, description: "Limpieza técnica mensual", quantity: 2, unit_price: 100, subtotal: 200 },
        ],
        covered_locations: [
            {
                id: 1,
                location_id: 19,
                location_name: "QA Ubicación Contrato 20261114",
                is_active: true,
                covered_from: "2026-11-14T08:00:00Z",
                covered_until: null,
                covered_zones: [],
            },
        ],
        created_at: "2026-11-14T08:00:00Z",
        updated_at: "2026-11-14T08:00:00Z",
        ...overrides,
    };
}

test.beforeEach(async ({ context, page }) => {
    test.skip(process.env.E2E_BASE_URL !== "http://localhost:3000", "Local UI regression only");
    await context.addCookies([{ name: "auth_token", value: makeToken(), url: "http://localhost:3000" }]);
    await page.addInitScript(() => localStorage.setItem("locale", "es"));
});

test("503 on contracts list shows error state with Retry instead of false empty state", async ({ page }) => {
    let failFirst = true;
    const contract = buildContract();

    await page.route("**/api/v1/**", async (route) => {
        const path = new URL(route.request().url()).pathname.replace(/\/$/, "");
        if (path === "/api/v1/users/me") {
            return route.fulfill({
                json: {
                    id: 46,
                    full_name: "QA Admin",
                    role: { name: "admin" },
                    company_id: 11,
                    is_active: true,
                    can_view_finance: true,
                    can_manage_finance: true,
                    can_view_labor_costs: true,
                },
            });
        }
        if (path === "/api/v1/companies/11") {
            return route.fulfill({ json: { id: 11, name: "QA Company", onboarding_completed: true, subscription_status: "active" } });
        }
        if (path.includes("entitlements")) {
            return route.fulfill({ json: { entitlements: [{ code: "features.quotes", value_type: "boolean", value: true }] } });
        }
        if (path === "/api/v1/service-contracts") {
            if (failFirst) {
                failFirst = false;
                return route.fulfill({ status: 503, json: { detail: "Temporalmente no disponible" } });
            }
            return route.fulfill({ json: [contract] });
        }
        if (path === "/api/v1/service-contracts/4") {
            return route.fulfill({ json: contract });
        }
        if (path === "/api/v1/service-contracts/4/location-candidates") {
            return route.fulfill({ json: [] });
        }
        if (path === "/api/v1/margin-forecasts/contracts/4") {
            return route.fulfill({
                json: {
                    scope_type: "contract",
                    scope_id: 4,
                    scope_name: contract.title,
                    budget: null,
                    planned_revenue_base_amount: 200,
                    planned_direct_cost_base_amount: 0,
                    planned_margin_base_amount: 200,
                    actual_revenue_base_amount: 0,
                    actual_labor_cost_base_amount: 0,
                    actual_material_cost_base_amount: 0,
                    actual_expense_cost_base_amount: 0,
                    actual_direct_cost_base_amount: 0,
                    actual_margin_base_amount: 0,
                    direct_cost_variance_base_amount: 0,
                },
            });
        }
        if (path === "/api/v1/clients") {
            return route.fulfill({ json: [{ id: 187, name: "QA Cliente Presupuestos 20261114" }] });
        }
        if (path.includes("alert-count")) {
            return route.fulfill({ json: { pending_requests: 0, pending_tasks: 0, unread_reports: 0 } });
        }
        return route.fulfill({ json: [] });
    });

    await page.goto("/dashboard/contracts?quote=5");
    await expect(page.getByRole("button", { name: "Reintentar", exact: true })).toBeVisible();
    await expect(page.getByText("Los contratos aparecerán cuando aceptes un presupuesto.")).toHaveCount(0);

    await page.getByRole("button", { name: "Reintentar", exact: true }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await expect(page.getByRole("dialog").getByText("CON-2026-0001")).toBeVisible();
});

for (const width of [1440, 768, 390]) {
    test(`contracts list view has no horizontal overflow at ${width}px`, async ({ page }) => {
        await page.setViewportSize({ width, height: 900 });
        const contract = buildContract();

        await page.route("**/api/v1/**", async (route) => {
            const path = new URL(route.request().url()).pathname.replace(/\/$/, "");
            if (path === "/api/v1/users/me") {
                return route.fulfill({
                    json: {
                        id: 46,
                        full_name: "QA Admin",
                        role: { name: "admin" },
                        company_id: 11,
                        is_active: true,
                        can_view_finance: true,
                        can_manage_finance: true,
                        can_view_labor_costs: true,
                    },
                });
            }
            if (path === "/api/v1/companies/11") {
                return route.fulfill({ json: { id: 11, name: "QA Company", onboarding_completed: true, subscription_status: "active" } });
            }
            if (path.includes("entitlements")) {
                return route.fulfill({ json: { entitlements: [{ code: "features.quotes", value_type: "boolean", value: true }] } });
            }
            if (path === "/api/v1/service-contracts") {
                return route.fulfill({ json: [contract] });
            }
            if (path === "/api/v1/clients") {
                return route.fulfill({ json: [{ id: 187, name: "QA Cliente Presupuestos 20261114" }] });
            }
            if (path.includes("alert-count")) {
                return route.fulfill({ json: { pending_requests: 0, pending_tasks: 0, unread_reports: 0 } });
            }
            return route.fulfill({ json: [] });
        });

        await page.goto("/dashboard/contracts");
        await expect(page.locator('[aria-label="Abrir contrato CON-2026-0001"]').filter({ visible: true })).toBeVisible();
        const overflow = await page.evaluate(() => ({
            scrollWidth: document.documentElement.scrollWidth,
            innerWidth: window.innerWidth,
        }));
        expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.innerWidth);
    });
}
