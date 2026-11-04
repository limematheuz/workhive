import { expect, test } from "@playwright/test";

for (const width of [320, 390, 640, 768, 1024, 1091, 1280, 1440, 1920]) {
    test(`location content stays readable without horizontal scrolling at ${width}px`, async ({ context, page }, testInfo) => {
        test.setTimeout(90_000);
        test.skip(process.env.E2E_BASE_URL !== "http://localhost:3000", "Local intercepted UI only");
        await page.setViewportSize({ width, height: 1000 });
        const payload = Buffer.from(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600 })).toString("base64url");
        await context.addCookies([{ name: "auth_token", value: `fixture.${payload}.not-a-backend-token`, url: process.env.E2E_BASE_URL! }]);
        await page.addInitScript(() => localStorage.setItem("locale", "es"));
        await page.route("**/api/v1/**", async route => {
            const path = new URL(route.request().url()).pathname.replace(/\/$/, "");
            let body: unknown = [];
            if (path === "/api/v1/users/me") body = { id: 36, full_name: "Administrador QA", email: "admin@example.test", company_id: 7, role: { id: 1, name: "admin" }, role_id: 1, is_active: true, can_view_finance: false };
            else if (path === "/api/v1/companies/7") body = { id: 7, name: "Empresa QA", onboarding_completed: true, subscription_status: "active" };
            else if (path.includes("entitlements")) body = { entitlements: [{ code: "features.locations", value_type: "boolean", value: true }] };
            else if (path === "/api/v1/clients/access") body = { can_read_clients: true };
            else if (path === "/api/v1/clients") body = [{ id: 1, name: "Cliente QA" }];
            else if (path === "/api/v1/locations") body = [{ id: 15, name: "Ubicación QA de prueba", address: "Calle QA 1", city: "Barcelona", client_id: 1, owner_company_id: 7, is_active: true, profile: { site_type: "office" } }];
            else if (path === "/api/v1/locations/15/operational-history") body = { location_id: 15, period: "day", period_start: "2026-11-04", period_end: "2026-11-04", completed_tasks: [], sessions: [], completed_task_count: 0, completed_task_total: 0, session_total: 0, worked_seconds: 0 };
            else if (path === "/api/v1/task-items") body = Array.from({ length: 11 }, (_, i) => ({ id: i + 1, location_id: 15, status: i < 4 ? "pending" : "completed" }));
            else if (path.includes("alert-count")) body = { pending_tasks: 4, pending_requests: 0, unread_reports: 0 };
            await route.fulfill({ json: body });
        });
        await page.goto("/dashboard/locations");
        for (const sidebar of ["initial", "toggled"]) {
            if (sidebar === "toggled") {
                await page.getByRole("button", { name: "Alternar navegación", exact: true }).click();
                if (width < 768) await page.keyboard.press("Escape");
            }
            const row = page.getByRole("row", { name: "Ver detalle de Ubicación QA de prueba", exact: true });
            const visible = row;
            await expect(visible).toBeVisible();
            await expect(visible).toContainText("Cliente QA");
            await expect(visible).not.toContainText("Calle QA 1");
            await expect(visible).toContainText(/11/);
            await expect(visible).toContainText(/4 pendientes/);
            await expect(visible).toContainText("Activo");
            if (await page.getByRole("columnheader", { name: "Total", exact: true }).isVisible()) {
                await expect(row.getByRole("cell", { name: "11", exact: true })).toBeVisible();
                await expect(row.getByRole("cell", { name: "4", exact: true })).toBeVisible();
            } else {
                await expect(row.getByText("11 tareas · 4 pendientes", { exact: true })).toBeVisible();
            }
            const overflow = await page.locator("main").evaluate(main => [main, ...main.querySelectorAll("section, table, td, th")].filter(el => el.clientWidth > 0 && el.scrollWidth > el.clientWidth + 1).map(el => el.tagName));
            expect(overflow).toEqual([]);
            await page.screenshot({ path: testInfo.outputPath(`locations-${sidebar}.png`) });
            if (sidebar === "initial") {
                await row.press("Enter");
                const detail = page.getByRole("dialog", { name: "Ubicación QA de prueba", exact: true });
                await expect(detail).toBeVisible();
                await expect(detail).toContainText("Calle QA 1");
                await page.keyboard.press("Escape");
                await expect(detail).toHaveCount(0);
            }
        }
    });
}
