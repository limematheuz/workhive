import { expect, test } from "@playwright/test";
import { selectSection } from "./helpers/select-section";

const image = { name: "qa-logo.png", mimeType: "image/png", buffer: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jT1sAAAAASUVORK5CYII=", "base64") };
for (const width of [1440, 768, 390]) {
    for (const failure of ["upload", "unsupported", "busy"] as const) {
        test(`company logo recovers from ${failure} failure at ${width}px`, async ({ context, page }) => {
            test.setTimeout(90_000);
            test.skip(process.env.E2E_BASE_URL !== "http://localhost:3000", "Local intercepted UI only");
            await page.setViewportSize({ width, height: 1000 });
            const payload = Buffer.from(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600 })).toString("base64url");
            await context.addCookies([{ name: "auth_token", value: `fixture.${payload}.not-a-backend-token`, url: process.env.E2E_BASE_URL! }]);
            await page.addInitScript(() => localStorage.setItem("locale", "es"));
            let failed = true;
            let uploads = 0;
            let writes = 0;
            let releaseUpload: () => void = () => {};
            const uploadGate = new Promise<void>(resolve => { releaseUpload = resolve; });
            await page.route("**/api/v1/**", async route => {
                const path = new URL(route.request().url()).pathname.replace(/\/$/, "");
                if (path === "/api/v1/uploads/media/company/7/qa-logo.png") return route.fulfill({ contentType: "image/png", body: image.buffer });
                let body: unknown = [];
                if (path === "/api/v1/users/me") body = { id: 36, full_name: "Administrador QA", email: "admin@example.test", company_id: 7, role: { id: 1, name: "admin" }, role_id: 1, is_active: true, can_view_finance: false };
                else if (path === "/api/v1/companies/7") {
                    if (route.request().method() !== "GET") writes++;
                    body = { id: 7, name: "Empresa QA", tax_id: "B00000000", address: "Calle QA 1", postal_code: "08001", city: "Barcelona", province: "Barcelona", phone: "600000000", email: "qa@example.test", logo: null, onboarding_completed: true, subscription_status: "active" };
                } else if (path === "/api/v1/uploads") {
                    uploads++;
                    if (failure === "busy" && uploads === 1) await uploadGate;
                    if (failed && failure !== "busy") return route.fulfill({ status: 503, json: { detail: "Subida QA no disponible" } });
                    body = { url: "/api/v1/uploads/media/company/7/qa-logo.png" };
                } else if (path.includes("entitlements")) body = { entitlements: [] };
                else if (path.includes("alert-count")) body = { pending_tasks: 0, unread_reports: 0, pending_requests: 0 };
                else if (path.includes("stats")) body = { total_hours: 0, total_tasks: 0, completed_tasks: 0 };
                await route.fulfill({ json: body });
            });
            await page.goto("/dashboard/profile", { waitUntil: "domcontentloaded" });
            await page.getByRole("button", { name: "Editar Datos", exact: true }).click();
            const editor = page.locator("section").filter({ has: page.getByRole("heading", { name: "Configuración de Cuenta", exact: true }) });
            await selectSection(editor, page, /Empresa/i);
            await expect(editor.locator("#company-name")).toHaveValue("Empresa QA");
            await editor.locator("#company-name").fill("Borrador QA conservado");
            const input = editor.locator('input[type="file"]');
            if (failure === "busy") {
                try {
                    await input.setInputFiles(image);
                    await expect.poll(() => uploads).toBe(1);
                    await input.setInputFiles({ ...image, name: "qa-logo-second.png" });
                    await expect(page.getByText("Por favor espere a que termine de subirse el logotipo", { exact: true })).toBeVisible();
                    expect(uploads).toBe(1);
                } finally {
                    releaseUpload();
                }
                await expect(page.getByText("Logotipo cargado en el formulario", { exact: true })).toBeVisible();
                await expect(input).toHaveValue("");
                await expect(editor.locator("#company-name")).toHaveValue("Borrador QA conservado");
                expect(writes).toBe(0);
                await editor.getByRole("button", { name: "Cancelar", exact: true }).click();
                return;
            }
            await input.setInputFiles(failure === "upload" ? image : { name: "qa-logo.svg", mimeType: "image/svg+xml", buffer: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>') });
            await expect(page.locator("[data-sonner-toast]").getByText(failure === "upload" ? "Subida QA no disponible" : "Only JPG, PNG, WEBP or GIF images are allowed.", { exact: true })).toBeVisible();
            await expect(page.locator('[data-sonner-toast][data-type="loading"]')).toHaveCount(0);
            await expect(input).toHaveValue("");
            await expect(editor.locator("#company-name")).toHaveValue("Borrador QA conservado");
            expect(uploads).toBe(failure === "upload" ? 1 : 0);
            expect(writes).toBe(0);
            failed = false;
            await input.setInputFiles(image);
            await expect(page.getByText("Logotipo cargado en el formulario", { exact: true })).toBeVisible();
            await expect(page.locator('[data-sonner-toast][data-type="loading"]')).toHaveCount(0);
            await expect(input).toHaveValue("");
            await expect(editor.getByRole("img", { name: "Logo", exact: true })).toBeVisible();
            await expect.poll(() => editor.getByRole("img", { name: "Logo", exact: true }).evaluate(img => (img as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
            expect(uploads).toBe(failure === "upload" ? 2 : 1);
            await editor.getByRole("button", { name: "Cancelar", exact: true }).click();
            expect(writes).toBe(0);
        });
    }
}
