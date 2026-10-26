import { expect, test } from "@playwright/test";
import { mkdir } from "node:fs/promises";

for (const width of [1440, 768, 390]) {
    for (const commercialRead of [true, false]) {
        test(`client consultation respects commercial and finance permissions at ${width}px (commercial=${commercialRead})`, async ({ context, page }) => {
            test.skip(process.env.E2E_BASE_URL !== "http://localhost:3000", "Local UI regression only");
            await page.setViewportSize({ width, height: 1000 });
            const payload = Buffer.from(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600 })).toString("base64url");
            await context.addCookies([{ name: "auth_token", value: `fixture.${payload}.not-a-backend-token`, url: "http://localhost:3000" }]);
            await page.addInitScript(() => { localStorage.setItem("locale", "es"); });
            const customer = { id: 1, name: "QA Consulta", city: "Madrid", address: "QA", country: "España", is_active: true, company_id: 1, client_type: "individual" };
            const requests: { path: string; method: string }[] = [];
            await page.route("**/api/v1/**", async route => {
                const path = new URL(route.request().url()).pathname.replace(/\/$/, "");
                requests.push({ path, method: route.request().method() });
                let body: unknown = [];
                if (path === "/api/v1/users/me") body = { id: 1, full_name: "QA Consulta", role: { name: "viewer" }, company_id: 1, is_active: true, can_view_finance: false, can_manage_finance: false };
                else if (path === "/api/v1/companies/1") body = { id: 1, name: "QA", onboarding_completed: true, subscription_status: "active" };
                else if (path === "/api/v1/clients/access") body = { can_read_clients: true, can_manage_clients: false, can_read_commercial_follow_ups: commercialRead, can_manage_commercial_follow_ups: false };
                else if (path === "/api/v1/clients") body = [customer];
                else if (path === "/api/v1/clients/1") body = customer;
                else if (path === "/api/v1/clients/1/opportunities") body = [{ id: 1, client_id: 1, title: "QA seguimiento", stage: "new", contact_id: null, owner_membership_id: null }];
                else if (path.endsWith("/opportunities/1/activities")) body = [{ id: 1, activity_type: "note", body: "Historial de consulta QA", happened_at: "2026-10-26T09:00:00Z", actor_name: "QA" }];
                else if (path.includes("alert-count")) body = { pending_requests: 0, pending_tasks: 0, unread_reports: 0 };
                await route.fulfill({ json: body });
            });
            await page.goto("/dashboard/clients");
            await expect(page.getByRole("button", { name: "Nuevo Cliente", exact: true })).toHaveCount(0);
            if (width >= 1280) await page.getByRole("row").filter({ hasText: "QA Consulta" }).click();
            else await page.getByRole("button", { name: "Ver detalle de QA Consulta", exact: true }).click();
            const parent = page.getByRole("dialog").filter({ has: page.getByRole("heading", { name: "QA Consulta", exact: true }) });
            await expect(parent.getByRole("heading", { name: "Información general", exact: true })).toBeVisible();
            await expect(parent.getByRole("button", { name: "Editar", exact: true })).toHaveCount(0);
            await expect(parent.getByRole("button", { name: "Añadir persona", exact: true })).toHaveCount(0);
            const expectedTabs = ["Resumen", ...(commercialRead ? ["Seguimiento"] : []), "Ubicaciones (0)", "Trabajos (0)"];
            if (width >= 1024) {
                await expect(parent.getByRole("tab")).toHaveCount(expectedTabs.length);
                for (let index = 0; index < expectedTabs.length; index++) {
                    await expect(parent.getByRole("tab").nth(index)).toHaveAccessibleName(expectedTabs[index]);
                }
                if (commercialRead) await parent.getByRole("tab", { name: "Seguimiento", exact: true }).click();
            } else {
                await parent.getByRole("combobox", { name: "Seleccionar sección", exact: true }).click();
                expect(await page.getByRole("option").allTextContents()).toEqual(expectedTabs);
                await page.getByRole("option", { name: commercialRead ? "Seguimiento" : "Resumen", exact: true }).click();
            }
            if (commercialRead) {
                await expect(parent.getByRole("heading", { name: "QA seguimiento", exact: true })).toBeVisible();
                await expect(parent.getByRole("button", { name: "Nuevo seguimiento", exact: true })).toHaveCount(0);
                await expect(parent.getByRole("button", { name: "Editar seguimiento", exact: true })).toHaveCount(0);
                await parent.getByRole("button", { name: "Actividad", exact: true }).click();
                const timeline = page.getByRole("dialog", { name: "Actividad: QA seguimiento", exact: true });
                await expect(timeline.getByText("Historial de consulta QA", { exact: true })).toBeVisible();
                await expect(timeline.getByRole("textbox")).toHaveCount(0);
                await expect(timeline.getByRole("button", { name: "Añadir actividad", exact: true })).toHaveCount(0);
            }
            await mkdir("/tmp/workhive-client-permission-review", { recursive: true });
            await page.screenshot({ path: `/tmp/workhive-client-permission-review/${commercialRead ? "commercial-reader" : "client-reader"}-${width}.png` });
            expect(requests.filter(request => request.method !== "GET")).toEqual([]);
            expect(requests.filter(request => /invoices|opportunity-owners/.test(request.path))).toEqual([]);
            if (!commercialRead) expect(requests.filter(request => /opportunities/.test(request.path))).toEqual([]);
        });
    }
}
