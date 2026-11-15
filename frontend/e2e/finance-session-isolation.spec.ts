import { expect, test } from "@playwright/test";

test("expenses never adopt a pending read from the previous identity", async ({ context, page }) => {
    test.skip(process.env.E2E_BASE_URL !== "http://localhost:3000", "Local UI regression only");
    const token = Buffer.from(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600 })).toString("base64url");
    await context.addCookies([{ name: "auth_token", value: `fixture.${token}.not-a-backend-token`, url: "http://localhost:3000" }]);
    await page.addInitScript(() => localStorage.setItem("locale", "es"));
    let identity = 1;
    let requested = false;
    let release = () => {};
    const pending = new Promise<void>(resolve => { release = resolve; });
    await page.route("**/api/v1/**", async route => {
        const path = new URL(route.request().url()).pathname.replace(/\/$/, "");
        if (path.endsWith("/users/me")) return route.fulfill({ json: { id: identity, company_id: identity * 11, full_name: `QA Finance ${identity}`, role: { name: "manager" }, is_active: true, can_view_finance: true, can_manage_finance: true } });
        if (/\/companies\/\d+$/.test(path)) return route.fulfill({ json: { id: identity * 11, name: "QA", onboarding_completed: true, subscription_status: "active" } });
        if (path.endsWith("/expenses")) {
            const owner = identity;
            if (owner === 2) return route.fulfill({ status: 403, json: { detail: "Denied" } });
            requested = true;
            await pending;
            const now = new Date();
            return route.fulfill({ json: [{ id: 1, company_id: 11, expense_date: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`, description: "Gasto privado anterior", category: "services", vendor: "QA", base_amount: 10, tax_amount: 2.1, total_amount: 12.1, is_active: true }] });
        }
        return route.fulfill({ json: [] });
    });
    try {
        await page.goto("/dashboard/expenses");
        await expect.poll(() => requested).toBe(true);
        identity = 2;
        await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent("pageshow", { persisted: true })));
        await expect(page.getByRole("button", { name: /QA Finance 2.*manager/ })).toBeVisible();
        release();
        await expect(page.locator("main").getByRole("alert")).toContainText("No tienes permisos");
        await expect(page.getByText("Gasto privado anterior", { exact: true })).toHaveCount(0);
    } finally { release(); }
});
