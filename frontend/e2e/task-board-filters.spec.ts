import { expect, test } from "@playwright/test";

// Isolated fixtures: filtering never changes real tasks or accounts.
for (const width of [1440, 768, 390]) {
    test(`board combines shared assignees, visible search and location at ${width}px`, async ({ context, page }) => {
        test.skip(process.env.E2E_BASE_URL !== "http://localhost:3000", "Local UI regression only");
        await page.setViewportSize({ width, height: 900 });
        const token = Buffer.from(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600 })).toString("base64url");
        await context.addCookies([{ name: "auth_token", value: `fixture.${token}.not-a-backend-token`, url: "http://localhost:3000" }]);
        await page.addInitScript(() => localStorage.setItem("locale", "es"));
        const now = new Date().toISOString();
        const tasks = [
            { id: 1, title: "QA compartida", location_id: 1, user_id: 1, assignments: [{ user_id: 1, user_name: "QA Principal", source: "direct", status: "pending" }, { user_id: 2, user_name: "QA Segunda", source: "checklist", status: "pending" }] },
            { id: 2, title: "QA otra sede", location_id: 2, user_id: 2, assignments: [{ user_id: 2, user_name: "QA Segunda", source: "direct", status: "pending" }] },
            { id: 3, title: "QA sin asignar", location_id: 1, user_id: null, assignments: [] },
        ].map(task => ({ ...task, company_id: 1, status: "pending", priority: "medium", unit: "servicio", quantity: 1, price: 1, created_at: now, description: 'Instrucción visible\n<!-- workhive_assignees: {"user_ids":[1,2],"note":"MetadataOculta"} -->', checklist_items: [] }));
        await page.route("**/api/v1/**", async route => {
            const path = new URL(route.request().url()).pathname.replace(/\/$/, "");
            let body: unknown = [];
            if (path === "/api/v1/users/me") body = { id: 1, full_name: "QA Principal", company_id: 1, role: { name: "admin" }, is_active: true };
            else if (path === "/api/v1/users") body = [{ id: 1, full_name: "QA Principal", is_active: true }, { id: 2, full_name: "QA Segunda", is_active: true }];
            else if (path === "/api/v1/companies/1") body = { id: 1, name: "QA", onboarding_completed: true, subscription_status: "active" };
            else if (path === "/api/v1/task-items") body = tasks;
            else if (path === "/api/v1/locations") body = [{ id: 1, name: "QA Norte", address: "QA", is_active: true }, { id: 2, name: "QA Sur", address: "QA", is_active: true }];
            else if (path === "/api/v1/work-sessions/active") body = null;
            else if (path.includes("alert-count")) body = { pending_requests: 0, pending_tasks: 0, unread_reports: 0 };
            await route.fulfill({ json: body });
        });
        await page.goto("/dashboard/tasks");
        const shared = page.getByRole("button", { name: "Abrir tarea: QA compartida", exact: true });
        const other = page.getByRole("button", { name: "Abrir tarea: QA otra sede", exact: true });
        const unassigned = page.getByRole("button", { name: "Abrir tarea: QA sin asignar", exact: true });
        await expect(shared).toBeVisible();
        const card = page.locator("article").filter({ has: shared });
        await expect(card.getByRole("heading", { name: "QA compartida", exact: true })).toBeVisible();
        await expect(card.getByText("QA Norte", { exact: true })).toBeVisible();
        await expect(card.getByLabel("Requisitos: 0 de 1")).toBeVisible();
        await expect(card).not.toContainText("Instrucción visible");
        expect((await card.boundingBox())?.height).toBeLessThan(240);
        const worker = page.getByRole("combobox", { name: "Todos los trabajadores", exact: true });
        await worker.click();
        await page.getByRole("option", { name: "QA Segunda", exact: true }).click();
        await expect(shared).toBeVisible();
        await expect(other).toBeVisible();
        await expect(unassigned).toHaveCount(0);
        await page.getByRole("combobox", { name: "Todas las ubicaciones", exact: true }).click();
        await page.getByRole("option", { name: "QA Norte", exact: true }).click();
        await expect(shared).toBeVisible();
        await expect(other).toHaveCount(0);
        const search = page.getByPlaceholder("Buscar tarea por título o descripción...");
        await search.fill("   qA CoMpArTiDa   ");
        await expect(shared).toBeVisible();
        await search.fill("MetadataOculta");
        await expect(shared).toHaveCount(0);
        await search.fill("Instrucción visible");
        await expect(shared).toBeVisible();
        await search.fill("");
        await worker.click();
        await page.getByRole("option", { name: "Todos los trabajadores", exact: true }).click();
        await expect(unassigned).toBeVisible();
    });
}
