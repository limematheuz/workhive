import { expect, test } from "@playwright/test";

for (const width of [1440, 768, 390]) {
    test(`client activity protects drafts and clears saved changes at ${width}px`, async ({ context, page }) => {
        test.skip(process.env.E2E_BASE_URL !== "http://localhost:3000", "Local UI regression only");
        await page.setViewportSize({ width, height: 1000 });
        const payload = Buffer.from(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600 })).toString("base64url");
        await context.addCookies([{ name: "auth_token", value: `fixture.${payload}.not-a-backend-token`, url: "http://localhost:3000" }]);
        await page.addInitScript(() => { localStorage.setItem("locale", "es"); });
        const customer = { id: 1, name: "QA Activity", city: "Madrid", address: "QA", country: "España", is_active: true, company_id: 1, client_type: "individual" };
        const opportunity = { id: 1, client_id: 1, title: "QA seguimiento", stage: "new", contact_id: null, owner_membership_id: null };
        const activities: object[] = [];
        let failSave = true;
        await page.route("**/api/v1/**", async route => {
            const path = new URL(route.request().url()).pathname.replace(/\/$/, "");
            let body: unknown = [];
            if (path === "/api/v1/users/me") body = { id: 1, full_name: "QA", role: { name: "admin" }, company_id: 1, is_active: true };
            else if (path === "/api/v1/companies/1") body = { id: 1, name: "QA", onboarding_completed: true, subscription_status: "active" };
            else if (path === "/api/v1/clients/access") body = { can_read_clients: true, can_manage_clients: true, can_read_commercial_follow_ups: true, can_manage_commercial_follow_ups: true };
            else if (path === "/api/v1/clients") body = [customer];
            else if (path === "/api/v1/clients/1") body = customer;
            else if (path === "/api/v1/clients/1/opportunities") body = [opportunity];
            else if (path.endsWith("/opportunities/1/activities")) {
                if (route.request().method() === "POST") {
                    if (failSave) {
                        failSave = false;
                        await route.fulfill({ status: 503, json: { detail: "Fallo QA temporal" } });
                        return;
                    }
                    const activity = { id: 1, ...route.request().postDataJSON(), happened_at: new Date().toISOString(), actor_name: "QA" };
                    activities.push(activity);
                    body = activity;
                } else body = activities;
            }
            else if (path.includes("alert-count")) body = { pending_requests: 0, pending_tasks: 0, unread_reports: 0 };
            await route.fulfill({ json: body });
        });
        await page.goto("/dashboard/clients");
        if (width >= 1280) await page.getByRole("row").filter({ hasText: "QA Activity" }).click();
        else await page.getByRole("button", { name: "Ver detalle de QA Activity", exact: true }).click();
        const parent = page.getByRole("dialog").filter({ has: page.getByRole("heading", { name: "QA Activity", exact: true }) });
        if (width >= 1024) await parent.getByRole("tab", { name: "Seguimiento", exact: true }).click();
        else {
            await parent.getByRole("combobox", { name: "Seleccionar sección", exact: true }).click();
            await page.getByRole("option", { name: "Seguimiento", exact: true }).click();
        }
        await parent.getByRole("button", { name: "Actividad", exact: true }).click();
        const timeline = page.getByRole("dialog", { name: "Actividad: QA seguimiento", exact: true });
        const draft = timeline.getByLabel("Nota o resultado", { exact: true });
        await draft.fill("Nota QA pendiente");
        await timeline.getByRole("button", { name: "Cerrar", exact: true }).click();
        await expect(page.getByRole("alertdialog")).toBeVisible();
        await page.getByRole("button", { name: "Seguir editando", exact: true }).click();
        await timeline.getByRole("button", { name: "Añadir actividad", exact: true }).click();
        await expect(page.getByText("No se pudo guardar la actividad comercial", { exact: true })).toBeVisible();
        await expect(draft).toHaveValue("Nota QA pendiente");
        await timeline.getByRole("button", { name: "Close", exact: true }).click();
        await expect(page.getByRole("alertdialog")).toBeVisible();
        await page.getByRole("button", { name: "Seguir editando", exact: true }).click();
        await timeline.getByRole("button", { name: "Añadir actividad", exact: true }).click();
        await expect(draft).toHaveValue("");
        await expect(timeline.getByText("Nota QA pendiente", { exact: true })).toBeVisible();
        await timeline.getByRole("button", { name: "Close", exact: true }).click();
        await expect(page.getByRole("alertdialog")).toHaveCount(0);
        await expect(timeline).toHaveCount(0);
        expect(activities).toHaveLength(1);
        await parent.getByRole("button", { name: "Actividad", exact: true }).click();
        await draft.fill("Otra nota sin guardar");
        await timeline.getByRole("button", { name: "Cerrar", exact: true }).click();
        await expect(page.getByRole("alertdialog")).toBeVisible();
        await page.getByRole("button", { name: "Salir sin guardar", exact: true }).click();
        await expect(timeline).toHaveCount(0);
        await parent.getByRole("button", { name: "Close", exact: true }).click();
        await expect(page.getByRole("alertdialog")).toHaveCount(0);
    });
}
