import { expect, test } from "@playwright/test";

for (const width of [1440, 768, 390]) {
    test(`inactive linked contacts remain visible and require an explicit replacement at ${width}px`, async ({ context, page }) => {
        test.skip(process.env.E2E_BASE_URL !== "http://localhost:3000", "Local UI regression only");
        await page.setViewportSize({ width, height: 1000 });
        const payload = Buffer.from(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600 })).toString("base64url");
        await context.addCookies([{ name: "auth_token", value: `fixture.${payload}.not-a-backend-token`, url: "http://localhost:3000" }]);
        await page.addInitScript(() => { localStorage.setItem("locale", "es"); });
        const customer = { id: 1, name: "QA Guard", city: "Madrid", address: "QA", country: "España", is_active: true, company_id: 1, client_type: "individual" };
        let opportunity = { id: 1, client_id: 1, title: "QA original", stage: "new", contact_id: 5 as number | null, owner_membership_id: null, owner_name: null, next_follow_up_at: "2026-11-02T08:00:00Z" as string | null, loss_reason: null };
        const contact = { id: 5, client_id: 1, full_name: "QA persona", email: null, phone: null, job_title: null, roles: ["commercial"], is_primary: false, is_active: false };
        let saves = 0;
        await page.route("**/api/v1/**", async route => {
            const path = new URL(route.request().url()).pathname.replace(/\/$/, "");
            let body: unknown = [];
            if (path === "/api/v1/users/me") body = { id: 1, full_name: "QA", role: { name: "admin" }, company_id: 1, is_active: true };
            else if (path === "/api/v1/companies/1") body = { id: 1, name: "QA", onboarding_completed: true, subscription_status: "active" };
            else if (path === "/api/v1/clients/access") body = { can_read_clients: true, can_manage_clients: true, can_read_commercial_follow_ups: true, can_manage_commercial_follow_ups: true };
            else if (path === "/api/v1/clients") body = [customer];
            else if (path === "/api/v1/clients/1") body = customer;
            else if (path === "/api/v1/clients/1/contacts") body = [contact];
            else if (path === "/api/v1/clients/1/opportunities") body = [opportunity];
            else if (path === "/api/v1/clients/1/opportunities/1") {
                if (route.request().method() === "PATCH") { saves++; opportunity = { ...opportunity, ...route.request().postDataJSON() }; }
                body = opportunity;
            }
            else if (path.includes("alert-count")) body = { pending_requests: 0, pending_tasks: 0, unread_reports: 0 };
            await route.fulfill({ json: body });
        });
        await page.goto("/dashboard/clients");
        if (width >= 1280) await page.getByRole("row").filter({ hasText: "QA Guard" }).click();
        else await page.getByRole("button", { name: "Ver detalle de QA Guard", exact: true }).click();
        const parent = page.getByRole("dialog").filter({ has: page.getByRole("heading", { name: "QA Guard", exact: true }) });
        if (width >= 1024) await parent.getByRole("tab", { name: "Seguimiento", exact: true }).click();
        else {
            await parent.getByRole("combobox", { name: "Seleccionar sección", exact: true }).click();
            await page.getByRole("option", { name: "Seguimiento", exact: true }).click();
        }
        await parent.getByRole("button", { name: "Editar seguimiento", exact: true }).click();
        const editor = page.getByRole("dialog", { name: "Editar seguimiento", exact: true });
        const selector = editor.getByRole("combobox", { name: "Persona de contacto", exact: true });
        await expect(selector).toHaveText("QA persona · Inactivo");
        await expect(editor.getByText("La persona vinculada está inactiva. Elige otra persona o selecciona «Sin contacto concreto» antes de guardar.", { exact: true })).toBeVisible();
        await expect(editor.getByRole("button", { name: "Guardar seguimiento", exact: true })).toBeDisabled();
        expect(saves).toBe(0);
        await selector.click();
        await expect(page.getByRole("option", { name: "QA persona · Inactivo", exact: true })).toBeDisabled();
        await page.getByRole("option", { name: "Sin contacto concreto", exact: true }).click();
        await expect(editor.getByRole("button", { name: "Guardar seguimiento", exact: true })).toBeEnabled();
        await editor.getByRole("button", { name: "Cancelar", exact: true }).click();
        await expect(page.getByRole("alertdialog")).toBeVisible();
        await page.getByRole("button", { name: "Seguir editando", exact: true }).click();
        await editor.getByRole("button", { name: "Guardar seguimiento", exact: true }).click();
        await expect(editor).toHaveCount(0);
        expect(opportunity.contact_id).toBeNull();
        expect(saves).toBe(1);
        await parent.getByRole("button", { name: "Editar seguimiento", exact: true }).click();
        await selector.click();
        await expect(page.getByRole("option", { name: "QA persona · Inactivo", exact: true })).toHaveCount(0);
        await page.getByRole("option", { name: "Sin contacto concreto", exact: true }).click();
        await editor.getByRole("button", { name: "Cancelar", exact: true }).click();
    });
}
