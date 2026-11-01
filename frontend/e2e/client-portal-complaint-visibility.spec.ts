import { expect, test } from "@playwright/test";

for (const width of [1440, 768, 390]) {
    test(`client portal explains shared complaints at ${width}px`, async ({ context, page }, testInfo) => {
        test.skip(process.env.E2E_BASE_URL !== "http://localhost:3000", "Local UI regression only");
        await page.setViewportSize({ width, height: 1000 });
        const token = Buffer.from(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600 })).toString("base64url");
        await context.addCookies([{ name: "auth_token", value: `fixture.${token}.not-a-backend-token`, url: "http://localhost:3000" }]);
        await page.addInitScript(() => localStorage.setItem("locale", "es"));
        let writes = 0;
        const workspace = { id: 1, company_name: "QA Proveedor", client_name: "QA Cliente", status: "active" };
        await page.route("**/api/v1/**", async route => {
            if (route.request().method() !== "GET") writes++;
            const path = new URL(route.request().url()).pathname;
            let body: unknown = [];
            if (path === "/api/v1/users/me") body = { id: 1, full_name: "QA contacto", role: { name: "client_portal" }, company_id: null, is_active: true };
            else if (path === "/api/v1/client-portal/workspaces") body = [workspace];
            else if (path.endsWith("/overview")) body = { workspace, quotes: [], contracts: [], invoices: [], inspections: [], complaints: [], complaint_locations: [] };
            await route.fulfill({ json: body });
        });
        await page.goto("/dashboard/client");
        await expect(page.getByText("Las reclamaciones y sus respuestas se comparten entre todas las personas con acceso autorizado al portal de este cliente.", { exact: false })).toBeVisible();
        await expect(page.getByText("Las notas internas quedan reservadas al proveedor.", { exact: false })).toBeVisible();
        await expect(page.getByText(/tus propias reclamaciones/)).toHaveCount(0);
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
        expect(writes).toBe(0);
        await page.screenshot({ path: testInfo.outputPath("shared-complaints.png"), fullPage: true });
    });
}
