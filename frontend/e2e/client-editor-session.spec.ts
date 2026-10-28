import { expect, test, type Page } from "@playwright/test";

async function openEditor(page: Page) {
    await page.getByRole("button", { name: "Acciones para QA editor", exact: true }).click();
    await page.getByRole("menuitem", { name: "Editar", exact: true }).click();
    return page.getByRole("dialog", { name: "Editar cliente", exact: true });
}

for (const width of [1440, 768, 390]) {
    for (const scenario of ["inactive", "discarded controls"]) {
        test(`reopened client editor resets ${scenario} at ${width}px`, async ({ context, page }) => {
            test.skip(process.env.E2E_BASE_URL !== "http://localhost:3000", "Local UI regression only");
            await page.setViewportSize({ width, height: 1000 });
            const payload = Buffer.from(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600 })).toString("base64url");
            await context.addCookies([{ name: "auth_token", value: `fixture.${payload}.not-a-backend-token`, url: "http://localhost:3000" }]);
            await page.addInitScript(() => localStorage.setItem("locale", "es"));
            let customer = { id: 1, name: "QA editor", client_type: "individual", relationship_status: "client", address: "QA street", city: "QA", postal_code: "00000", country: "España", is_active: true, company_id: 1, phone: null as string | null };
            const writes: Record<string, unknown>[] = [];
            await page.route("**/api/v1/**", async route => {
                const path = new URL(route.request().url()).pathname.replace(/\/$/, "");
                let body: unknown = [];
                if (path === "/api/v1/users/me") body = { id: 1, full_name: "QA", role: { name: "admin" }, company_id: 1, is_active: true };
                else if (path === "/api/v1/companies/1") body = { id: 1, name: "QA", onboarding_completed: true, subscription_status: "active" };
                else if (path === "/api/v1/clients/access") body = { can_read_clients: true, can_manage_clients: true };
                else if (path === "/api/v1/clients") body = [customer];
                else if (path === "/api/v1/clients/1") {
                    if (route.request().method() === "PATCH") {
                        const update = route.request().postDataJSON();
                        writes.push(update);
                        customer = { ...customer, ...update };
                    }
                    body = customer;
                }
                else if (path.includes("alert-count")) body = { pending_requests: 0, pending_tasks: 0, unread_reports: 0 };
                await route.fulfill({ json: body });
            });
            await page.goto("/dashboard/clients");
            let dialog = await openEditor(page);
            if (scenario === "discarded controls") {
                await dialog.getByRole("button", { name: "Empresa", exact: true }).click();
                await dialog.getByRole("combobox", { name: "Relación comercial", exact: true }).click();
                await page.getByRole("option", { name: "Prospecto", exact: true }).click();
            }
            await dialog.getByRole("button", { name: "Cancelar", exact: true }).click();
            if (scenario === "discarded controls") {
                await expect(page.getByRole("alertdialog")).toBeVisible();
                await page.getByRole("button", { name: "Seguir editando", exact: true }).click();
                await expect(dialog.getByRole("combobox", { name: "Relación comercial", exact: true })).toHaveText("Prospecto");
                await dialog.getByRole("button", { name: "Cancelar", exact: true }).click();
                await page.getByRole("button", { name: "Salir sin guardar", exact: true }).click();
            }
            await expect(dialog).toHaveCount(0);
            if (scenario === "inactive") {
                await page.getByRole("button", { name: "Acciones para QA editor", exact: true }).click();
                await page.getByRole("menuitem", { name: "Desactivar", exact: true }).click();
                await expect(page.getByText("Inactivo", { exact: true }).filter({ visible: true })).toBeVisible();
            }
            dialog = await openEditor(page);
            if (scenario === "inactive") await expect(dialog.getByRole("checkbox", { name: "Inactivo", exact: true })).not.toBeChecked();
            await expect(dialog.getByRole("combobox", { name: "Relación comercial", exact: true })).toHaveText("Cliente");
            await dialog.getByRole("textbox", { name: "Teléfono", exact: true }).fill("000000000");
            await dialog.getByRole("button", { name: "Guardar", exact: true }).click();
            await expect(dialog).toHaveCount(0);
            expect(customer.is_active).toBe(scenario !== "inactive");
            expect(customer.client_type).toBe("individual");
            expect(customer.relationship_status).toBe("client");
            expect(customer.phone).toBe("000000000");
            expect(writes).toHaveLength(scenario === "inactive" ? 2 : 1);
        });
    }
}
