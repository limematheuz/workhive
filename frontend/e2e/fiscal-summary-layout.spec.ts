import { expect, test } from "@playwright/test";

for (const locale of ["es", "en"]) {
    for (const width of [1440, 1032, 768, 390]) {
        test(`fiscal period labels fit at ${width}px in ${locale}`, async ({ context, page }) => {
            test.skip(process.env.E2E_BASE_URL !== "http://localhost:3000", "Local UI regression only");
            await page.setViewportSize({ width, height: 1000 });
            const token = Buffer.from(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600 })).toString("base64url");
            await context.addCookies([{ name: "auth_token", value: `fixture.${token}.not-a-backend-token`, url: "http://localhost:3000" }]);
            await page.addInitScript(value => localStorage.setItem("locale", value), locale);
            await page.route("**/api/v1/**", async route => {
                const url = new URL(route.request().url());
                const path = url.pathname.replace(/\/$/, "");
                let body: unknown = [];
                if (path === "/api/v1/users/me") body = { id: 1, full_name: "QA", role: { name: "admin" }, company_id: 1, is_active: true, can_view_finance: true };
                else if (path === "/api/v1/companies/1") body = { id: 1, name: "QA", onboarding_completed: true, subscription_status: "active" };
                else if (path === "/api/v1/fiscal-summary") {
                    const periods = [1, 2, 3, 4].map(n => ({ key: `Q${n}`, label: `T${n}`, issued_invoice_count: 0, registered_expense_count: 0 }));
                    body = { year: Number(url.searchParams.get("year")), periods, annual: { ...periods[0], key: "annual", label: "2026" } };
                }
                await route.fulfill({ json: body });
            });
            await page.goto("/dashboard/fiscal-summary");
            await expect(page.getByText("T4", { exact: true }).filter({ visible: true })).toBeVisible();
            if (width >= 1024) {
                await expect(page.getByRole("table")).toBeVisible();
                for (const header of await page.getByRole("columnheader").all()) {
                    const bounds = await header.evaluate(element => {
                        const cell = element.getBoundingClientRect();
                        const range = document.createRange();
                        range.selectNodeContents(element);
                        return { left: cell.left, right: cell.right, lines: [...range.getClientRects()].map(r => ({ left: r.left, right: r.right })) };
                    });
                    for (const line of bounds.lines) {
                        expect(line.left).toBeGreaterThanOrEqual(bounds.left - 0.5);
                        expect(line.right).toBeLessThanOrEqual(bounds.right + 0.5);
                    }
                }
            } else {
                await expect(page.getByRole("table")).toBeHidden();
            }
            const layout = await page.evaluate(() => ({ content: document.documentElement.scrollWidth, viewport: window.innerWidth }));
            expect(layout.content).toBeLessThanOrEqual(layout.viewport);
        });
    }
}
