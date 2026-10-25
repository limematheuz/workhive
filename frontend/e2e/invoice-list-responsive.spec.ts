import { expect, test } from "@playwright/test";

const number = "QA-PORTAL-20261015-INVOICE-CON-NUMERO-LARGO";

for (const width of [1440, 1091, 768, 390]) {
    test(`long invoice number stays inside its column at ${width}px`, async ({ context, page }) => {
        test.skip(process.env.E2E_BASE_URL !== "http://localhost:3000", "Local UI regression only");
        await page.setViewportSize({ width, height: 1000 });
        const payload = Buffer.from(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600 })).toString("base64url");
        await context.addCookies([{ name: "auth_token", value: `fixture.${payload}.not-a-backend-token`, url: "http://localhost:3000" }]);
        await page.addInitScript(() => { localStorage.setItem("locale", "es"); });
        const invoice = { id: 1, invoice_number: number, client_id: 1, company_id: 1, status: "issued", issue_date: new Date().toISOString(), total_amount: 121, base_amount: 100, tax_amount: 21, discount: 0, retention: 0, equivalence_surcharge: 0, is_rectification: false, fiscal_submission_status: "not_configured", items: [], payment_method: "bank_transfer" };
        await page.route("**/api/v1/**", async route => {
            const path = new URL(route.request().url()).pathname.replace(/\/$/, "");
            let body: unknown = [];
            if (path === "/api/v1/users/me") body = { id: 1, full_name: "Usuario de prueba", role: { name: "admin" }, company_id: 1, is_active: true };
            else if (path === "/api/v1/companies/1") body = { id: 1, name: "Prueba", onboarding_completed: true, subscription_status: "active" };
            else if (path === "/api/v1/invoices") body = [invoice];
            else if (path === "/api/v1/invoices/1") body = invoice;
            else if (path.includes("/fiscal/") || path.includes("/facturae/")) body = null;
            else if (path === "/api/v1/clients") body = [{ id: 1, name: "Cliente de prueba" }];
            else if (path === "/api/v1/clients/1") body = { id: 1, name: "Cliente de prueba" };
            else if (path.includes("alert-count")) body = { pending_requests: 0, pending_tasks: 0, unread_reports: 0 };
            await route.fulfill({ json: body });
        });
        await page.goto("/dashboard/invoices");
        const button = page.getByRole("button", { name: number, exact: width >= 768 });
        await expect(button).toBeVisible();
        if (width >= 768) {
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
        await expect(page.getByRole("dialog").getByRole("heading", { name: number, exact: true }).first()).toBeVisible();
    });
}
