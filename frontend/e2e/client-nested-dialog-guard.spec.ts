import { expect, test } from "@playwright/test";

for (const width of [1440, 768, 390]) {
    test(`nested client editors protect cancellation and keep their parent clean at ${width}px`, async ({ context, page }) => {
        test.skip(process.env.E2E_BASE_URL !== "http://localhost:3000", "Local UI regression only");
        await page.setViewportSize({ width, height: 1000 });
        const payload = Buffer.from(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600 })).toString("base64url");
        await context.addCookies([{ name: "auth_token", value: `fixture.${payload}.not-a-backend-token`, url: "http://localhost:3000" }]);
        await page.addInitScript(() => { localStorage.setItem("locale", "es"); });
        const customer = { id: 1, name: "QA Guard", city: "Madrid", address: "QA", country: "España", is_active: true, company_id: 1, client_type: "individual" };
        let opportunity = { id: 1, client_id: 1, title: "QA original", stage: "new", contact_id: null, owner_membership_id: null, owner_name: null, next_follow_up_at: null, loss_reason: null };
        let contact = { id: 5, client_id: 1, full_name: "QA persona", email: null, phone: null, job_title: null, roles: ["commercial"], is_primary: false, is_active: true };
        await page.route("**/api/v1/**", async route => {
            const path = new URL(route.request().url()).pathname.replace(/\/$/, "");
            let body: unknown = [];
            if (path === "/api/v1/users/me") body = { id: 1, full_name: "QA", role: { name: "admin" }, company_id: 1, is_active: true };
            else if (path === "/api/v1/companies/1") body = { id: 1, name: "QA", onboarding_completed: true, subscription_status: "active" };
            else if (path === "/api/v1/clients/access") body = { can_read_clients: true, can_manage_clients: true, can_read_commercial_follow_ups: true, can_manage_commercial_follow_ups: true };
            else if (path === "/api/v1/clients") body = [customer];
            else if (path === "/api/v1/clients/1") body = customer;
            else if (path === "/api/v1/clients/1/contacts") body = [contact];
            else if (path === "/api/v1/clients/1/contacts/5") {
                if (route.request().method() === "PATCH") contact = { ...contact, ...route.request().postDataJSON() };
                body = contact;
            }
            else if (path === "/api/v1/clients/1/opportunities") body = [opportunity];
            else if (path === "/api/v1/clients/1/opportunities/1") {
                if (route.request().method() === "PATCH") opportunity = { ...opportunity, ...route.request().postDataJSON() };
                body = opportunity;
            }
            else if (path.includes("alert-count")) body = { pending_requests: 0, pending_tasks: 0, unread_reports: 0 };
            await route.fulfill({ json: body });
        });
        await page.goto("/dashboard/clients");
        if (width >= 1280) await page.getByRole("row").filter({ hasText: "QA Guard" }).click();
        else await page.getByRole("button", { name: "Ver detalle de QA Guard", exact: true }).click();
        const parent = page.getByRole("dialog").filter({ has: page.getByRole("heading", { name: "QA Guard", exact: true }) });
        await parent.getByRole("button", { name: "Editar contacto", exact: true }).click();
        const contactEditor = page.getByRole("dialog", { name: "Editar contacto", exact: true });
        const nameField = contactEditor.locator("#contact-full-name");
        await nameField.fill("QA borrador");
        await contactEditor.getByRole("button", { name: "Cancelar", exact: true }).click();
        await expect(page.getByRole("alertdialog")).toBeVisible();
        await page.getByRole("button", { name: "Seguir editando", exact: true }).click();
        await expect(nameField).toHaveValue("QA borrador");
        await contactEditor.getByRole("button", { name: "Cancelar", exact: true }).click();
        await page.getByRole("button", { name: "Salir sin guardar", exact: true }).click();
        await expect(contactEditor).toHaveCount(0);
        expect(contact.full_name).toBe("QA persona");
        await parent.getByRole("button", { name: "Editar contacto", exact: true }).click();
        await expect(nameField).toHaveValue("QA persona");
        await nameField.fill("QA persona guardada");
        await contactEditor.getByRole("button", { name: "Guardar contacto", exact: true }).click();
        await expect(contactEditor).toHaveCount(0);
        await expect(parent.getByRole("heading", { name: "QA persona guardada", exact: true })).toBeVisible();
        if (width >= 1024) await parent.getByRole("tab", { name: "Seguimiento", exact: true }).click();
        else {
            await parent.getByRole("combobox", { name: "Seleccionar sección", exact: true }).click();
            await page.getByRole("option", { name: "Seguimiento", exact: true }).click();
        }
        await parent.getByRole("button", { name: "Editar seguimiento", exact: true }).click();
        const editor = page.getByRole("dialog", { name: "Editar seguimiento", exact: true });
        for (const label of ["Situación", "Responsable", "Persona de contacto"]) {
            await expect(editor.getByRole("combobox", { name: label, exact: true })).toBeVisible();
        }
        await editor.getByRole("combobox", { name: "Situación", exact: true }).click();
        await page.getByRole("option", { name: "En conversación", exact: true }).click();
        await editor.getByRole("button", { name: "Cancelar", exact: true }).click();
        await expect(page.getByRole("alertdialog")).toBeVisible();
        await page.getByRole("button", { name: "Seguir editando", exact: true }).click();
        await editor.getByRole("button", { name: "Cancelar", exact: true }).click();
        await page.getByRole("button", { name: "Salir sin guardar", exact: true }).click();
        await expect(editor).toHaveCount(0);
        expect(opportunity.stage).toBe("new");
        await parent.getByRole("button", { name: "Editar seguimiento", exact: true }).click();
        await expect(editor.getByRole("combobox", { name: "Situación", exact: true })).toHaveText("Por contactar");
        await editor.getByLabel("Asunto", { exact: true }).fill("QA guardado");
        await editor.getByRole("button", { name: "Guardar seguimiento", exact: true }).click();
        await expect(editor).toHaveCount(0);
        await expect(parent.getByRole("heading", { name: "QA guardado", exact: true })).toBeVisible();
        await parent.getByRole("button", { name: "Close", exact: true }).click();
        await expect(page.getByRole("alertdialog")).toHaveCount(0);
        await expect(parent).toHaveCount(0);
    });
}
