import { expect, test } from "@playwright/test";
import { selectSection } from "./helpers/select-section";

for (const width of [1440, 768, 390]) {
    test(`company editing requires a successful read and preserves a rejected draft at ${width}px`, async ({ context, page }, testInfo) => {
        test.skip(process.env.E2E_BASE_URL !== "http://localhost:3000", "Local intercepted UI only");
        await page.setViewportSize({ width, height: 1000 });
        const payload = Buffer.from(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600 })).toString("base64url");
        await context.addCookies([{ name: "auth_token", value: `fixture.${payload}.not-a-backend-token`, url: process.env.E2E_BASE_URL! }]);
        await page.addInitScript(() => localStorage.setItem("locale", "es"));
        let failRead = false;
        let failWrite = true;
        const writes: unknown[] = [];
        const company = { id: 7, name: "Empresa QA", tax_id: "B00000000", address: "Calle QA 1", postal_code: "08001", city: "Barcelona", province: "Barcelona", phone: "600000000", email: "qa@example.test", onboarding_completed: true, subscription_status: "active", subscription_plan: "top" };
        await page.route("**/api/v1/**", async route => {
            const path = new URL(route.request().url()).pathname.replace(/\/$/, "");
            let body: unknown = [];
            if (path === "/api/v1/users/me") body = { id: 36, full_name: "Administrador QA", email: "admin@example.test", company_id: 7, role: { id: 1, name: "admin" }, role_id: 1, is_active: true, can_view_finance: false };
            else if (path === "/api/v1/companies/7") {
                if (route.request().method() === "PATCH") {
                    writes.push(route.request().postDataJSON());
                    if (failWrite) return route.fulfill({ status: 503, json: { detail: "Guardado QA no disponible" } });
                    Object.assign(company, route.request().postDataJSON());
                } else if (failRead) return route.fulfill({ status: 503, json: { detail: "Lectura QA no disponible" } });
                body = company;
            } else if (path.includes("entitlements")) body = { entitlements: [] };
            else if (path.includes("alert-count")) body = { pending_tasks: 0, unread_reports: 0, pending_requests: 0 };
            else if (path.includes("stats")) body = { total_hours: 0, total_tasks: 0, completed_tasks: 0 };
            await route.fulfill({ json: body });
        });
        await page.goto("/dashboard/profile");
        await page.getByRole("button", { name: "Editar Datos", exact: true }).click();
        failRead = true;
        const editor = page.locator("section").filter({ has: page.getByRole("heading", { name: "Configuración de Cuenta", exact: true }) });
        await selectSection(editor, page, /Empresa/i);
        await expect(editor.getByRole("alert")).toContainText("No se pudieron cargar los datos de la empresa");
        await expect(editor.locator("#company-name")).toHaveCount(0);
        await expect(editor.getByRole("button", { name: "Guardar", exact: true })).toHaveCount(0);
        expect(writes).toEqual([]);
        await page.screenshot({ path: testInfo.outputPath("company-read-error.png") });
        failRead = false;
        await editor.getByRole("button", { name: "Reintentar", exact: true }).click();
        await expect(editor.locator("#company-name")).toHaveValue("Empresa QA");
        await editor.locator("#company-name").fill("Empresa QA revisada");
        await editor.getByRole("button", { name: "Guardar", exact: true }).click();
        await expect(page.getByText("Guardado QA no disponible", { exact: true })).toBeVisible();
        await expect(editor.locator("#company-name")).toHaveValue("Empresa QA revisada");
        expect(writes).toHaveLength(1);
        failWrite = false;
        await editor.getByRole("button", { name: "Guardar", exact: true }).click();
        await expect(editor).toHaveCount(0);
        expect(writes).toHaveLength(2);
        expect(writes[1]).toEqual({ name: "Empresa QA revisada", tax_id: "B00000000", address: "Calle QA 1", postal_code: "08001", city: "Barcelona", province: "Barcelona", phone: "600000000", email: "qa@example.test", bank_account: null, swift_bic: null, default_payment_notes: null, default_document_terms: null, logo: null });
        await page.getByRole("button", { name: "Editar Datos", exact: true }).click();
        await selectSection(editor, page, /Empresa/i);
        await expect(editor.locator("#company-name")).toHaveValue("Empresa QA revisada");
        await editor.getByRole("button", { name: "Cancelar", exact: true }).click();
        expect(writes).toHaveLength(2);
    });
}
