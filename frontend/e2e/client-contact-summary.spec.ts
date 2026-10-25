import { expect, test } from "@playwright/test";

for (const locale of ["es", "en"]) {
    for (const width of [1440, 768, 390]) {
        test(`client contact summary distinguishes record fields at ${width}px in ${locale}`, async ({ context, page }) => {
            test.skip(process.env.E2E_BASE_URL !== "http://localhost:3000", "Local UI regression only");
            await page.setViewportSize({ width, height: 1000 });
            const payload = Buffer.from(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600 })).toString("base64url");
            await context.addCookies([{ name: "auth_token", value: `fixture.${payload}.not-a-backend-token`, url: "http://localhost:3000" }]);
            await page.addInitScript(language => { localStorage.setItem("locale", language); }, locale);
            const clients = [
                { id: 1, name: "QA Phone", phone: "600123456", email: null },
                { id: 2, name: "QA Email", email: "contact@example.com", phone: null },
                { id: 3, name: "QA Empty", email: null, phone: null },
            ].map(client => ({ ...client, company_id: 1, is_active: true, client_type: "individual", address: "QA", city: "Madrid", country: "España" }));
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
            await expect(page.getByText("600123456", { exact: true }).filter({ visible: true })).toBeVisible();
            await expect(page.getByText("contact@example.com", { exact: true }).filter({ visible: true })).toBeVisible();
            const description = locale === "es"
                ? "Sin correo ni teléfono en la ficha. No incluye contactos adicionales."
                : "No email or phone on the client record. Additional contacts are not included.";
            const metric = page.locator("article").filter({ hasText: description });
            await expect(metric).toContainText("1");
            const filter = page.getByRole("combobox", { name: locale === "es" ? "Contacto en ficha" : "Contact on record" });
            await filter.click();
            await page.getByRole("option", { name: locale === "es" ? "Sin correo ni teléfono" : "No email or phone", exact: true }).click();
            await expect(page.getByText("QA Empty", { exact: true }).filter({ visible: true })).toBeVisible();
            await expect(page.getByText("QA Phone", { exact: true }).filter({ visible: true })).toHaveCount(0);
            await expect(page.getByText("QA Email", { exact: true }).filter({ visible: true })).toHaveCount(0);
            await filter.click();
            await page.getByRole("option", { name: locale === "es" ? "Con correo o teléfono" : "Has email or phone", exact: true }).click();
            await expect(page.getByText("QA Empty", { exact: true }).filter({ visible: true })).toHaveCount(0);
            await expect(page.getByText("600123456", { exact: true }).filter({ visible: true })).toBeVisible();
        });
    }
}
