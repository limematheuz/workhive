import { expect, test } from "@playwright/test";

// Isolated UI fixtures: no local account or client data is changed.
for (const path of ["/dashboard/clients", "/dashboard/client", "/dashboard/client/profile", "/dashboard/quotes", "/dashboard/reservations"]) {
    test(`header distinguishes the client workspace at ${path}`, async ({ context, page }) => {
        test.skip(process.env.E2E_BASE_URL !== "http://localhost:3000", "Local UI regression only");
        const portal = path === "/dashboard/client" || path.startsWith("/dashboard/client/");
        const payload = Buffer.from(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600 })).toString("base64url");
        await context.addCookies([{ name: "auth_token", value: `fixture.${payload}.not-a-backend-token`, url: "http://localhost:3000" }]);
        await page.addInitScript(() => { localStorage.setItem("locale", "es"); });
        await page.route("**/api/v1/**", async route => {
            const requestPath = new URL(route.request().url()).pathname.replace(/\/$/, "");
            let body: unknown = [];
            if (requestPath === "/api/v1/users/me") body = { id: 1, full_name: "Usuario de prueba", role: { name: portal ? "client_portal" : "admin" }, company_id: 1, is_active: true };
            else if (requestPath === "/api/v1/companies/1") body = { id: 1, name: "Prueba", onboarding_completed: true, subscription_status: "active" };
            else if (requestPath === "/api/v1/clients/access") body = { can_read_clients: true, can_manage_clients: true };
            else if (requestPath.includes("entitlements")) body = { entitlements: [{ code: "features.clients", value_type: "boolean", value: true }] };
            else if (requestPath.includes("alert-count")) body = { pending_requests: 0, pending_tasks: 0, unread_reports: 0 };
            await route.fulfill({ json: body });
        });
        await page.goto(path);
        await expect(page.locator("header").first().getByRole("heading", { level: 1 })).toHaveText(path === "/dashboard/reservations" ? "Reservas y Estancias" : portal ? "Portal de cliente" : path === "/dashboard/quotes" ? "Presupuestos" : "Clientes");
    });
}
