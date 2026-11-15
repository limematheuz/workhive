import { expect, test, type Page } from "@playwright/test";

test.beforeEach(() => test.skip(process.env.E2E_BASE_URL !== "http://localhost:3000", "Local UI regression only"));

async function setAuthSession(
    page: Page,
    user: { id: number; email: string; full_name: string; role: { name: string }; company_id: number | null; is_active: boolean },
) {
    const payload = Buffer.from(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600 })).toString("base64url");
    await page.context().addCookies([
        { name: "auth_token", value: `fixture.${payload}.not-a-backend-token`, url: "http://localhost:3000" },
    ]);
    await page.addInitScript(() => localStorage.setItem("locale", "es"));
    await page.route("**/api/v1/**", (route) => route.fulfill({ json: [] }));
    await page.route("**/api/v1/realtime/events", (route) =>
        route.fulfill({ status: 200, contentType: "text/event-stream", body: 'event: ready\ndata: {"realtime":true}\n\n' }),
    );
    await page.route("**/api/v1/notifications/**", (route) => route.fulfill({ json: [] }));
    await page.route("**/api/v1/users/me", (route) => route.fulfill({ json: user }));
    await page.route("**/api/v1/**/alert-count**", (route) =>
        route.fulfill({ json: { pending_requests: 0, pending_tasks: 0, unread_reports: 0 } }),
    );
}

for (const width of [1440, 768, 390]) {
    test(`integrations and traffic recover from 503 without blank or false-empty state at ${width}px`, async ({ page }) => {
        await page.setViewportSize({ width, height: 960 });
        await setAuthSession(page, {
            id: 99,
            email: "qa-superadmin@example.test",
            full_name: "QA Superadmin",
            role: { name: "superadmin" },
            company_id: null,
            is_active: true,
        });

        let integrationsStatus = 503;
        await page.route("**/api/v1/calendar/platform/status", (route) => {
            if (integrationsStatus !== 200) {
                return route.fulfill({ status: integrationsStatus, json: { detail: "Unavailable" } });
            }
            return route.fulfill({
                json: {
                    environment_enabled: true,
                    google_cloud_configured: false,
                    company_connections_enabled: true,
                    available: false,
                    redirect_uri: "http://localhost:3000/api/v1/calendar/google/callback",
                    timezone: "Europe/Madrid",
                    background_sync_enabled: true,
                    connected_companies: 2,
                    pending_ownership_requests: 1,
                },
            });
        });

        await page.goto("/dashboard/integrations");
        const integrationsAlert = page.locator("[data-integrations-read-error]");
        await expect(integrationsAlert).toBeVisible();
        await expect(integrationsAlert.getByRole("button", { name: "Reintentar" })).toBeVisible();

        integrationsStatus = 200;
        await integrationsAlert.getByRole("button", { name: "Reintentar" }).click();
        await expect(integrationsAlert).toHaveCount(0);
        await expect(page.getByRole("heading", { name: "Google Calendar" })).toBeVisible();

        integrationsStatus = 403;
        await page.getByRole("button", { name: /Actualizar|Refresh/i }).click();
        await expect(integrationsAlert).toBeVisible();
        await expect(integrationsAlert.getByRole("button", { name: "Reintentar" })).toHaveCount(0);
        await expect(page.getByRole("switch")).toHaveCount(0);

        let auditStatus = 503;
        await page.route("**/api/v1/audit-logs/**", (route) => {
            if (auditStatus !== 200) {
                return route.fulfill({ status: auditStatus, json: { detail: "Unavailable" } });
            }
            return route.fulfill({
                json: [
                    {
                        id: 501,
                        action: "auth.login",
                        entity_type: "session",
                        entity_id: "99",
                        actor_user_id: 99,
                        company_id: null,
                        created_at: new Date().toISOString(),
                        details: {
                            user_email: "qa-superadmin@example.test",
                            company_name: "Plataforma",
                            ip: "127.0.0.1",
                            user_agent: "Mozilla/5.0",
                            geo: {},
                        },
                    },
                ],
            });
        });

        await page.goto("/dashboard/traffic");
        const trafficAlert = page.locator("[data-traffic-read-error]");
        await expect(trafficAlert).toBeVisible();
        await expect(page.getByText("Todavía no hay accesos registrados")).toHaveCount(0);
        await expect(page.getByText("Solo superadmin", { exact: true })).toHaveCount(0);

        auditStatus = 200;
        await trafficAlert.getByRole("button", { name: "Reintentar" }).click();
        await expect(trafficAlert).toHaveCount(0);
        await expect(page.getByText("qa-superadmin@example.test").filter({ visible: true }).first()).toBeVisible();
    });

    test(`api-access keeps workspace on entitlement or list 503 and isolates 403 at ${width}px`, async ({ page }) => {
        await page.setViewportSize({ width, height: 960 });
        await setAuthSession(page, {
            id: 77,
            email: "qa-api@example.test",
            full_name: "QA API Admin",
            role: { name: "admin" },
            company_id: 13,
            is_active: true,
        });
        await page.route("**/api/v1/companies/13", (route) =>
            route.fulfill({ json: { id: 13, name: "QA Enterprise", onboarding_completed: true, subscription_plan: "mega", subscription_status: "active" } }),
        );

        let entitlementsStatus = 503;
        await page.route("**/api/v1/companies/current/entitlements", (route) => {
            if (entitlementsStatus !== 200) {
                return route.fulfill({ status: entitlementsStatus, json: { detail: "Unavailable" } });
            }
            return route.fulfill({
                json: { entitlements: [{ code: "features.api", label: "API", group: "Funciones", value_type: "boolean", value: true, source: "plan", availability: "available" }] },
            });
        });

        let keysStatus = 503;
        await page.route("**/api/v1/api-access-keys/**", (route) => {
            if (keysStatus !== 200) {
                return route.fulfill({ status: keysStatus, json: { detail: "Unavailable" } });
            }
            return route.fulfill({
                json: [
                    {
                        id: 12,
                        name: "QA Key E2E",
                        key_prefix: "whk_e2e_pref",
                        scopes: ["work_orders.read"],
                        status: "active",
                        last_used_at: null,
                        created_at: new Date().toISOString(),
                        revoked_at: null,
                        expires_at: null,
                    },
                ],
            });
        });

        await page.goto("/dashboard/api-access");
        await expect(page).toHaveURL(/\/dashboard\/api-access$/);
        const alert = page.locator("[data-api-access-read-error]");
        await expect(alert).toBeVisible();
        await expect(alert.getByRole("button", { name: "Reintentar" })).toBeVisible();

        entitlementsStatus = 200;
        await alert.getByRole("button", { name: "Reintentar" }).click();
        await expect(alert).toBeVisible();
        await expect(page.getByText("Aún no hay claves API emitidas.", { exact: true })).toHaveCount(0);

        keysStatus = 200;
        await alert.getByRole("button", { name: "Reintentar" }).click();
        await expect(alert).toHaveCount(0);
        await expect(page.getByText("QA Key E2E", { exact: true })).toBeVisible();

        keysStatus = 403;
        await page.reload();
        await expect(alert).toBeVisible();
        await expect(alert.getByRole("button", { name: "Reintentar" })).toHaveCount(0);
        await expect(page.getByText("QA Key E2E", { exact: true })).toHaveCount(0);
    });
}
