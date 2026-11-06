import { readFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";

for (const locale of ["es", "en"] as const) {
    for (const width of [1440, 768, 390]) {
        for (const failingList of ["mine", "company"] as const) {
            test(`privacy recovers ${failingList} read without allowing duplicate erasure in ${locale} at ${width}px`, async ({ context, page }, testInfo) => {
                test.skip(process.env.E2E_BASE_URL !== "http://localhost:3000", "Local intercepted UI only");
                await page.setViewportSize({ width, height: 1000 });
                const payload = Buffer.from(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600 })).toString("base64url");
                await context.addCookies([{ name: "auth_token", value: `fixture.${payload}.not-a-backend-token`, url: process.env.E2E_BASE_URL! }]);
                await page.addInitScript(locale => localStorage.setItem("locale", locale), locale);
                const spanish = locale === "es";
                let failRead = true;
                let exports = 0;
                let writes = 0;
                const pending = { id: 42, requested_by_user_id: 36, company_id: 7, request_type: "erasure", status: "pending", reason: null, requested_at: "2026-11-06T08:00:00Z", resolved_at: null, resolution_notes: null };
                await page.route("**/api/v1/**", async route => {
                    const path = new URL(route.request().url()).pathname.replace(/\/$/, "");
                    let body: unknown = [];
                    if (route.request().method() !== "GET") writes++;
                    if (path === "/api/v1/users/me") body = { id: 36, full_name: "Administrador QA", email: "admin@example.test", company_id: 7, role: { id: 1, name: "admin" }, role_id: 1, is_active: true, can_view_finance: false };
                    else if (path === "/api/v1/companies/7") body = { id: 7, name: "Empresa QA", tax_id: "B00000000", address: "Calle QA 1", onboarding_completed: true, subscription_status: "active" };
                    else if (path === "/api/v1/privacy/requests/me" || path === "/api/v1/privacy/requests") {
                        if (failRead && path.endsWith(failingList === "mine" ? "/me" : "/requests")) return route.fulfill({ status: 503, json: { detail: "QA unavailable" } });
                        body = failingList === "mine" ? [pending] : [];
                    } else if (path === "/api/v1/privacy/export") {
                        exports++;
                        return route.fulfill({ headers: { "Content-Disposition": 'attachment; filename="qa-export.json"' }, json: { format: "workhive-data-export-v1", profile: { id: 36 } } });
                    } else if (path.includes("entitlements")) body = { entitlements: [] };
                    else if (path.includes("alert-count")) body = { pending_tasks: 0, unread_reports: 0, pending_requests: 0 };
                    else if (path.includes("stats")) body = { total_hours: 0, total_tasks: 0, completed_tasks: 0 };
                    await route.fulfill({ json: body });
                });
                await page.goto("/dashboard/profile", { waitUntil: "domcontentloaded" });
                const section = page.locator("section").filter({ has: page.getByRole("heading", { name: spanish ? "Privacidad y tus datos" : "Privacy and your data", exact: true }) });
                await section.waitFor({ state: "visible" });
                await expect(section.getByRole("alert")).toContainText(spanish ? "No se pudieron cargar las solicitudes de privacidad" : "Privacy requests could not be loaded");
                const erasure = section.getByRole("button", { name: spanish ? "Solicitar supresión" : "Request erasure", exact: true });
                await expect(erasure).toBeDisabled();
                const actionsFit = await section.evaluate(element => {
                    const bounds = element.getBoundingClientRect();
                    return Array.from(element.querySelectorAll("button")).every(button => {
                        const rect = button.getBoundingClientRect();
                        return rect.left >= bounds.left && rect.right <= bounds.right;
                    });
                });
                expect(actionsFit).toBe(true);
                if (spanish && failingList === "mine") {
                    await section.getByRole("alert").click();
                    await page.screenshot({ path: testInfo.outputPath("privacy-read-error.png") });
                }
                const download = page.waitForEvent("download");
                await section.getByRole("button", { name: spanish ? "Exportar mis datos" : "Export my data", exact: true }).click();
                const file = await download;
                expect(file.suggestedFilename()).toBe("qa-export.json");
                const savedPath = await file.path();
                expect(savedPath).not.toBeNull();
                expect(JSON.parse(await readFile(savedPath!, "utf8"))).toEqual({ format: "workhive-data-export-v1", profile: { id: 36 } });
                expect(exports).toBe(1);
                failRead = false;
                await section.getByRole("button", { name: spanish ? "Reintentar" : "Retry", exact: true }).click();
                await expect(section.getByRole("alert")).toHaveCount(0);
                if (failingList === "mine") {
                    await expect(section.getByText(spanish ? "Ya existe una solicitud de supresión pendiente." : "An erasure request is already pending.", { exact: true })).toBeVisible();
                    await expect(erasure).toBeDisabled();
                } else {
                    await expect(erasure).toBeEnabled();
                    await erasure.click();
                    const dialog = page.getByRole("dialog", { name: spanish ? "Solicitar supresión de la cuenta" : "Request account erasure", exact: true });
                    await expect(dialog).toBeVisible();
                    await dialog.getByRole("button", { name: spanish ? "Cancelar" : "Cancel", exact: true }).click();
                    await expect(dialog).toHaveCount(0);
                }
                expect(writes).toBe(0);
            });
        }
    }
}
