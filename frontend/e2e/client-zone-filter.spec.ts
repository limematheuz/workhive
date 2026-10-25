import { expect, test } from "@playwright/test";

for (const locale of ["es", "en"]) {
    for (const width of [1440, 768, 390]) {
        test(`client area filter shows its reset state at ${width}px in ${locale}`, async ({ context, page }) => {
            test.skip(process.env.E2E_BASE_URL !== "http://localhost:3000", "Local UI regression only");
            await page.setViewportSize({ width, height: 1000 });
            const payload = Buffer.from(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600 })).toString("base64url");
            await context.addCookies([{ name: "auth_token", value: `fixture.${payload}.not-a-backend-token`, url: "http://localhost:3000" }]);
            await page.addInitScript(language => { localStorage.setItem("locale", language); }, locale);
            const clients = ["Madrid", "Barcelona"].map((city, index) => ({ id: index + 1, name: `QA ${city}`, city, address: "QA", country: "España", is_active: true, company_id: 1, client_type: "individual" }));
            await page.route("**/api/v1/**", async route => {
                const path = new URL(route.request().url()).pathname.replace(/\/$/, "");
                let body: unknown = [];
                if (path === "/api/v1/users/me") body = { id: 1, full_name: "QA", role: { name: "admin" }, company_id: 1, is_active: true };
                else if (path === "/api/v1/companies/1") body = { id: 1, name: "QA", onboarding_completed: true, subscription_status: "active" };
                else if (path === "/api/v1/clients/access") body = { can_read_clients: true, can_manage_clients: true };
                else if (path === "/api/v1/clients") body = clients;
                else if (path.includes("alert-count")) body = { pending_requests: 0, pending_tasks: 0, unread_reports: 0 };
                await route.fulfill({ json: body });
            });
            await page.goto("/dashboard/clients");
            const filter = page.getByRole("combobox", { name: locale === "es" ? "Zona" : "Area", exact: true });
            const all = locale === "es" ? "Todas" : "All";
            await expect(filter).toContainText(all);
            await filter.click();
            await page.getByRole("option", { name: "Madrid", exact: true }).click();
            await expect(page.getByText("QA Madrid", { exact: true }).filter({ visible: true })).toBeVisible();
            await expect(page.getByText("QA Barcelona", { exact: true }).filter({ visible: true })).toHaveCount(0);
            await filter.click();
            await page.getByRole("option", { name: all, exact: true }).click();
            await expect(filter).toContainText(all);
            await expect(page.getByText("QA Barcelona", { exact: true }).filter({ visible: true })).toBeVisible();
            await page.getByRole("textbox", { name: locale === "es" ? "Buscar clientes" : "Search clients", exact: true }).fill("Barcelona");
            await filter.click();
            await page.getByRole("option", { name: "Madrid", exact: true }).click();
            await expect(page.getByText("QA Barcelona", { exact: true }).filter({ visible: true })).toHaveCount(0);
            await page.getByRole("button", { name: locale === "es" ? "Limpiar filtros" : "Clear filters", exact: true }).click();
            await expect(filter).toContainText(all);
            await expect(page.getByText("QA Madrid", { exact: true }).filter({ visible: true })).toBeVisible();
            await expect(page.getByText("QA Barcelona", { exact: true }).filter({ visible: true })).toBeVisible();
        });
    }
}
