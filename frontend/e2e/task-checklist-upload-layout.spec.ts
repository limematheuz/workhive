import { expect, test } from "@playwright/test";

// All traffic is intercepted; these checks never create real work or upload media.
for (const width of [1440, 828, 768, 390]) {
    test(`checklist photo control preserves modal layout at ${width}px`, async ({ context, page }) => {
        test.skip(process.env.E2E_BASE_URL !== "http://localhost:3000", "Local UI regression only");
        await page.setViewportSize({ width, height: 900 });
        const token = Buffer.from(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600 })).toString("base64url");
        await context.addCookies([{ name: "auth_token", value: `fixture.${token}.not-a-backend-token`, url: "http://localhost:3000" }]);
        await page.addInitScript(() => localStorage.setItem("locale", "es"));
        const now = new Date().toISOString();
        const task = {
            id: 1, title: "QA archivo checklist", unit: "servicio", price: 1, quantity: 1,
            status: "progress", priority: "high", company_id: 1, location_id: 1,
            created_at: now, scheduled_start_at: now, due_at: now,
            description: "- [ ] Ventilar (@1:QA:progress)", checklist_evidence: {},
            checklist_items: [{ id: 1, position: 0, text: "Ventilar", completed: false, assignments: [{ user_id: 1, user_name: "QA", status: "progress" }] }],
            assignments: [{ user_id: 1, user_name: "QA", status: "progress", source: "checklist" }],
        };
        await page.route("**/api/v1/**", async route => {
            const path = new URL(route.request().url()).pathname.replace(/\/$/, "");
            let body: unknown = [];
            if (path === "/api/v1/users/me") body = { id: 1, full_name: "QA", role: { name: "viewer" }, company_id: 1, is_active: true };
            else if (path === "/api/v1/companies/1") body = { id: 1, name: "QA", onboarding_completed: true, subscription_status: "active" };
            else if (path === "/api/v1/task-items") body = [task];
            else if (path === "/api/v1/task-items/1") body = task;
            else if (path === "/api/v1/locations") body = [{ id: 1, name: "QA ubicación", address: "QA", city: "QA", is_active: true }];
            else if (path === "/api/v1/work-sessions/active") body = { id: 1, task_item_id: 1, user_id: 1, location_id: 1, start_time: now, end_time: null, paused_seconds: 0 };
            else if (path.endsWith("/detailed-summary")) body = { total_seconds: 0, active_workers: 1, workers: [] };
            else if (path.endsWith("/detailed-summaries")) body = { summaries: [] };
            else if (path.includes("alert-count")) body = { pending_requests: 0, pending_tasks: 0, unread_reports: 0 };
            await route.fulfill({ json: body });
        });
        await page.goto("/dashboard");
        await page.getByRole("button", { name: "QA archivo checklist", exact: true }).click();
        await page.getByRole("button", { name: /0\s*\/\s*1\s*REQUISITOS/i }).click();
        const dialog = page.getByRole("dialog", { name: "Requisitos de la Tarea", exact: true });
        await expect(dialog).toBeVisible();
        const fileInput = dialog.locator('input[type="file"]');
        // A focusable offscreen file control must not expand or scroll its dialog.
        await expect(fileInput).toBeHidden();
        const chooserPromise = page.waitForEvent("filechooser");
        await dialog.locator('button[aria-label="Subir Foto"]').click();
        const chooser = await chooserPromise;
        await chooser.setFiles([]);
        const geometry = await dialog.evaluate(element => {
            const rect = element.getBoundingClientRect();
            const title = element.querySelector('[data-slot="dialog-title"]')!.getBoundingClientRect();
            return { width: element.clientWidth, scrollWidth: element.scrollWidth, scrollLeft: element.scrollLeft, left: rect.left, right: rect.right, titleLeft: title.left, titleRight: title.right };
        });
        expect(geometry.scrollWidth).toBeLessThanOrEqual(geometry.width + 1);
        expect(geometry.scrollLeft).toBe(0);
        expect(geometry.titleLeft).toBeGreaterThanOrEqual(geometry.left);
        expect(geometry.titleRight).toBeLessThanOrEqual(geometry.right);
        await dialog.getByRole("button", { name: "Añadir Nota", exact: true }).click();
        await dialog.getByRole("textbox", { name: /anotaciones operativas/i }).fill("QA nota editable");
        const afterEdit = await dialog.evaluate(element => element.scrollLeft);
        expect(afterEdit).toBe(0);
    });
}
