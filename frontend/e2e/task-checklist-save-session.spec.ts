import { selectSection } from "./helpers/select-section";
import { expect, test, type Page, type BrowserContext } from "@playwright/test";

async function openChecklist(context: BrowserContext, page: Page, width: number, failNote = false) {
    await page.setViewportSize({ width, height: 900 });
    const token = Buffer.from(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600 })).toString("base64url");
    await context.addCookies([{ name: "auth_token", value: `fixture.${token}.not-a-backend-token`, url: "http://localhost:3000" }]);
    await page.addInitScript(() => localStorage.setItem("locale", "es"));
    const now = new Date().toISOString();
    let active = true;
    let activeReads = 0;
    let savedNotes = 0;
    const task = {
        id: 1, title: "QA ciclo guardado", unit: "servicio", price: 1, quantity: 1,
        status: "progress", priority: "high", company_id: 1, location_id: 1,
        created_at: now, scheduled_start_at: now, due_at: now,
        description: "- [ ] Ventilar (@1:QA:progress)", checklist_evidence: {} as Record<string, unknown>,
        checklist_items: [{ id: 1, position: 0, text: "Ventilar", completed: false, assignments: [{ user_id: 1, user_name: "QA", status: "progress" }] }],
        assignments: [{ user_id: 1, user_name: "QA", status: "progress", source: "checklist" }],
    };
    await page.route("**/api/v1/**", async route => {
        const path = new URL(route.request().url()).pathname.replace(/\/$/, "");
        let body: unknown = [];
        if (path === "/api/v1/users/me") body = { id: 1, full_name: "QA", role: { name: "viewer" }, company_id: 1, is_active: true };
        else if (path === "/api/v1/users") body = [{ id: 1, full_name: "QA", email: "qa@example.test" }];
        else if (path === "/api/v1/companies/1") body = { id: 1, name: "QA", onboarding_completed: true, subscription_status: "active" };
        else if (path === "/api/v1/task-items") body = [task];
        else if (path === "/api/v1/task-items/1") body = task;
        else if (path === "/api/v1/task-items/1/checklist-items/1") {
            task.checklist_items[0].completed = true;
            task.checklist_evidence.item_1 = { answer: "yes" };
            task.assignments[0].status = "completed";
            task.status = "completed";
            active = false;
            body = task;
        }
        else if (path === "/api/v1/task-reports" && route.request().method() === "POST") {
            if (failNote) return route.fulfill({ status: 500, json: { detail: "QA save failure" } });
            const payload = route.request().postDataJSON();
            savedNotes++;
            task.checklist_evidence.item_1 = { note: payload.description };
            body = { id: 1, ...payload };
        }
        else if (path === "/api/v1/locations") body = [{ id: 1, name: "QA ubicación", address: "QA", city: "QA", is_active: true }];
        else if (path === "/api/v1/work-sessions/active") {
            activeReads++;
            body = active ? { id: 1, task_item_id: 1, user_id: 1, location_id: 1, start_time: now, end_time: null, paused_seconds: 0 } : null;
        }
        else if (path.endsWith("/detailed-summary")) body = { total_seconds: 0, active_workers: active ? 1 : 0, workers: [] };
        else if (path.endsWith("/detailed-summaries")) body = { summaries: [] };
        else if (path.includes("alert-count")) body = { pending_requests: 0, pending_tasks: 0, unread_reports: 0 };
        await route.fulfill({ json: body });
    });
    await page.goto("/dashboard");
    await page.getByRole("button", { name: "QA ciclo guardado", exact: true }).click();
    await page.getByRole("button", { name: /finalizar trabajo y reportar/i }).waitFor();
    await page.getByRole("button", { name: /0\s*\/\s*1\s*REQUISITOS/i }).click();
    const dialog = page.getByRole("dialog", { name: "Requisitos de la Tarea", exact: true });
    await expect(dialog).toBeVisible();
    return {
        dialog, activeReads: () => activeReads, savedNotes: () => savedNotes,
        completeOnServer: () => {
            active = false;
            task.status = "completed";
            task.assignments[0].status = "completed";
            task.checklist_items[0].completed = true;
            task.checklist_evidence.item_1 = { answer: "yes" };
        },
    };
}

for (const width of [1440, 768, 390]) {
    test(`saved checklist stops its session and closes cleanly at ${width}px`, async ({ context, page }) => {
        test.skip(process.env.E2E_BASE_URL !== "http://localhost:3000", "Local UI regression only");
        const state = await openChecklist(context, page, width);
        const readsBefore = state.activeReads();
        await state.dialog.getByRole("button", { name: "Sí", exact: true }).click();
        await expect.poll(state.activeReads, { timeout: 3000 }).toBeGreaterThan(readsBefore);
        await state.dialog.getByRole("checkbox", { name: "Ocultar Completados", exact: true }).click();
        await state.dialog.getByRole("button", { name: "Close", exact: true }).click();
        await expect(page.getByRole("alertdialog")).toHaveCount(0);
        await expect(state.dialog).toHaveCount(0);
        await expect(page.getByRole("button", { name: /finalizar trabajo y reportar/i })).toHaveCount(0);
        await expect(page.getByText("Tarea ya completada y validada", { exact: true })).toBeVisible();
        await page.getByRole("dialog", { name: "QA ciclo guardado", exact: true }).getByRole("button", { name: "Close", exact: true }).click();
        await expect(page.locator("button").filter({ hasText: /fichar salida/i })).toHaveCount(0);
        if (width >= 768) await expect(page.getByText(/sin jornada activa/i)).toBeVisible();
        else await expect(page.getByText("No tienes tareas aprobadas disponibles para iniciar.", { exact: true }).filter({ visible: true })).toBeVisible();
    });
    test(`view categories close without discarding at ${width}px`, async ({ context, page }) => {
        test.skip(process.env.E2E_BASE_URL !== "http://localhost:3000", "Local UI regression only");
        const state = await openChecklist(context, page, width);
        await selectSection(state.dialog, page, /baño/i);
        await state.dialog.getByRole("button", { name: "Close", exact: true }).click();
        await expect(page.getByRole("alertdialog")).toHaveCount(0);
        await expect(state.dialog).toHaveCount(0);
    });
    test(`saved note closes without discarding at ${width}px`, async ({ context, page }) => {
        test.skip(process.env.E2E_BASE_URL !== "http://localhost:3000", "Local UI regression only");
        const state = await openChecklist(context, page, width);
        await state.dialog.getByRole("button", { name: "Añadir Nota", exact: true }).click();
        await state.dialog.getByRole("textbox", { name: /anotaciones operativas/i }).fill("QA nota persistida");
        await state.dialog.getByRole("heading").click();
        await expect.poll(state.savedNotes).toBe(1);
        await state.dialog.getByRole("button", { name: "Close", exact: true }).click();
        await expect(page.getByRole("alertdialog")).toHaveCount(0);
        await expect(state.dialog).toHaveCount(0);
    });
    test(`saving a note preserves an unrelated extra-work draft at ${width}px`, async ({ context, page }) => {
        test.skip(process.env.E2E_BASE_URL !== "http://localhost:3000", "Local UI regression only");
        const state = await openChecklist(context, page, width);
        await state.dialog.getByText("Añadir elemento al checklist", { exact: true }).click();
        await state.dialog.locator('#new-checklist-question').fill("QA trabajo extra pendiente");
        await state.dialog.getByRole("button", { name: "Añadir Nota", exact: true }).click();
        await state.dialog.getByRole("textbox", { name: /anotaciones operativas/i }).fill("QA nota guardada aparte");
        await state.dialog.getByRole("heading").click();
        await expect.poll(state.savedNotes).toBe(1);
        await state.dialog.getByRole("button", { name: "Close", exact: true }).click();
        await expect(page.getByRole("alertdialog")).toBeVisible();
        await page.getByRole("button", { name: "Seguir editando", exact: true }).click();
        await expect(state.dialog.locator('#new-checklist-question')).toHaveValue("QA trabajo extra pendiente");
    });
    test(`failed note and extra-work draft stay guarded at ${width}px`, async ({ context, page }) => {
        test.skip(process.env.E2E_BASE_URL !== "http://localhost:3000", "Local UI regression only");
        const state = await openChecklist(context, page, width, true);
        await state.dialog.getByRole("button", { name: "Añadir Nota", exact: true }).click();
        await state.dialog.getByRole("textbox", { name: /anotaciones operativas/i }).fill("QA nota sin guardar");
        await state.dialog.getByRole("heading").click();
        await expect(page.getByText("No se pudo guardar la nota", { exact: true })).toBeVisible();
        await state.dialog.getByRole("button", { name: "Close", exact: true }).click();
        await expect(page.getByRole("alertdialog")).toBeVisible();
        await page.getByRole("button", { name: "Seguir editando", exact: true }).click();
        await state.dialog.getByText("Añadir elemento al checklist", { exact: true }).click();
        await state.dialog.locator('#new-checklist-question').fill("QA trabajo extra pendiente");
        await state.dialog.getByRole("button", { name: "Close", exact: true }).click();
        await expect(page.getByRole("alertdialog")).toBeVisible();
        expect(state.savedNotes()).toBe(0);
    });
}


test("server work invalidation refreshes both session displays", async ({ context, page }) => {
    test.skip(process.env.E2E_BASE_URL !== "http://localhost:3000", "Local UI regression only");
    const state = await openChecklist(context, page, 768);
    state.completeOnServer();
    await page.evaluate(() => window.dispatchEvent(new CustomEvent(
        "workhive:realtime-invalidation", { detail: ["tasks", "live-work"] },
    )));
    await state.dialog.getByRole("button", { name: "Close", exact: true }).click();
    await expect(page.getByText("Tarea ya completada y validada", { exact: true })).toBeVisible();
    await page.getByRole("dialog", { name: "QA ciclo guardado", exact: true }).getByRole("button", { name: "Close", exact: true }).click();
    await expect(page.getByText(/sin jornada activa/i)).toBeVisible();
    await expect(page.locator("button").filter({ hasText: /fichar salida/i })).toHaveCount(0);
});
