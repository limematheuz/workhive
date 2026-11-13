import { expect, test } from "@playwright/test";

for (const role of ["admin", "manager", "viewer"]) for (const width of [390, 768, 1440]) {
    test(`location actions follow each server scope: ${role} ${width}px`, async ({ context, page }) => {
        test.skip(process.env.E2E_BASE_URL !== "http://localhost:3000", "Local UI regression only");
        await page.setViewportSize({ width, height: 1000 });
        const token = Buffer.from(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600 })).toString("base64url");
        await context.addCookies([{ name: "auth_token", value: `fixture.${token}.not-a-backend-token`, url: "http://localhost:3000" }]);
        await page.addInitScript(() => localStorage.setItem("locale", "es"));
        let writes = 0;
        await page.route("**/api/v1/**", async route => {
            const request = route.request();
            if (!["GET", "HEAD"].includes(request.method())) writes++;
            const path = new URL(request.url()).pathname.replace(/\/$/, "");
            let body: unknown = [];
            if (path.endsWith("/users/me")) body = { id: 1, company_id: 1, role: { name: role }, full_name: "QA", is_active: true };
            else if (path.endsWith("/companies/1")) body = { id: 1, name: "QA", onboarding_completed: true, subscription_status: "active" };
            else if (path.endsWith("/clients/access")) body = { can_read_clients: false };
            else if (path.endsWith("/operational-history")) body = { location_id: 1, period: "week", period_start: "2026-11-09", period_end: "2026-11-15", completed_tasks: [], sessions: [], completed_task_count: 0, completed_task_total: 0, session_total: 0, worked_seconds: 0 };
            else if (path.endsWith("/locations")) body = [
                { id: 1, name: "QA Consulta", can_manage_location: false },
                { id: 2, name: "QA Gestión", can_manage_location: true },
                { id: 3, name: "QA Sin indicador" },
            ].map(location => ({ ...location, company_id: 1, owner_company_id: 1, managing_company_id: 1, address: "Dirección QA", city: "Ciudad QA", is_active: true }));
            await route.fulfill({ json: body });
        });
        await page.goto("/dashboard/locations");
        for (const name of ["QA Consulta", "QA Sin indicador"]) {
            const row = page.getByRole("row", { name: `Ver detalle de ${name}`, exact: true });
            await expect(row).toBeVisible();
            await expect(row.getByRole("button", { name: `Acciones para ${name}`, exact: true })).toHaveCount(0);
        }
        const manageable = page.getByRole("row", { name: "Ver detalle de QA Gestión", exact: true });
        await manageable.getByRole("button", { name: "Acciones para QA Gestión", exact: true }).click();
        await expect(page.getByRole("menuitem", { name: "Editar", exact: true })).toBeVisible();
        await page.keyboard.press("Escape");
        await page.getByRole("row", { name: "Ver detalle de QA Consulta", exact: true }).click();
        const detail = page.getByRole("dialog", { name: "QA Consulta", exact: true });
        await expect(detail).toBeVisible();
        await expect(detail.getByRole("button", { name: "Editar ubicación", exact: true })).toHaveCount(0);
        expect(writes).toBe(0);
    });
}
