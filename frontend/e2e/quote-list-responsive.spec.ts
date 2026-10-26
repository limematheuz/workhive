import { expect, test } from "@playwright/test";

const number = "QUO-QA-PORTAL-20261015-CON-NUMERO-LARGO";

for (const width of [1440, 1091, 768, 390]) {
    test(`long quote number stays inside its column at ${width}px`, async ({ context, page }) => {
        test.skip(process.env.E2E_BASE_URL !== "http://localhost:3000", "Local UI regression only");
        await page.setViewportSize({ width, height: 1000 });
        const payload = Buffer.from(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600 })).toString("base64url");
        await context.addCookies([{ name: "auth_token", value: `fixture.${payload}.not-a-backend-token`, url: "http://localhost:3000" }]);
        await page.addInitScript(() => { localStorage.setItem("locale", "es"); });
        const quote = { id: 1, quote_number: number, client_id: 1, company_id: 1, status: "draft", title: "QA presupuesto", revision_number: 1, created_at: new Date().toISOString(), total_amount: 121, base_amount: 100, tax_amount: 21, discount: 0, retention: 0, equivalence_surcharge: 0, tax_rate: 0.21, accepted_revision_id: null, items: [] };
        await page.route("**/api/v1/**", async route => {
            const path = new URL(route.request().url()).pathname.replace(/\/$/, "");
            let body: unknown = [];
            if (path === "/api/v1/users/me") body = { id: 1, full_name: "Usuario de prueba", role: { name: "admin" }, company_id: 1, is_active: true };
            else if (path === "/api/v1/companies/1") body = { id: 1, name: "Prueba", onboarding_completed: true, subscription_status: "active" };
            else if (path === "/api/v1/quotes") body = [quote];
            else if (path === "/api/v1/quotes/1") body = quote;
            else if (path === "/api/v1/clients") body = [{ id: 1, name: "Cliente de prueba" }];
            else if (path === "/api/v1/clients/1") body = { id: 1, name: "Cliente de prueba" };
            else if (path.includes("alert-count")) body = { pending_requests: 0, pending_tasks: 0, unread_reports: 0 };
            await route.fulfill({ json: body });
        });
        await page.goto("/dashboard/quotes");
        const button = page.getByRole("button", { name: number, exact: width >= 1280 });
        await expect(button).toBeVisible();
        if (width >= 1280) {
            const bounds = await button.evaluate(element => {
                const cell = element.closest("td")!.getBoundingClientRect();
                const link = element.getBoundingClientRect();
                return { right: link.right, limit: cell.right, left: link.left, start: cell.left };
            });
            expect(bounds.right).toBeLessThanOrEqual(bounds.limit);
            expect(bounds.left).toBeGreaterThanOrEqual(bounds.start);
            await expect(button).toHaveAttribute("title", number);
        } else {
            const bounds = await button.getByText(number, { exact: true }).evaluate(element => {
                const label = element.getBoundingClientRect();
                const status = element.parentElement!.nextElementSibling!.getBoundingClientRect();
                return { right: label.right, limit: status.left };
            });
            expect(bounds.right).toBeLessThanOrEqual(bounds.limit);
            await expect(button.getByText(number, { exact: true })).toHaveAttribute("title", number);
        }
        await button.click();
        await expect(page.getByRole("dialog")).toBeVisible();
        await expect(page.getByRole("dialog").getByRole("heading", { name: number, exact: false }).first()).toBeVisible();
    });
}
