import { expect, test } from "@playwright/test";

function makeToken() {
    const payload = Buffer.from(
        JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600 }),
    ).toString("base64url");
    return `fixture.${payload}.not-a-backend-token`;
}

function buildManager() {
    return {
        id: 51,
        email: "qa-manager-ops-20261114@example.com",
        full_name: "QA Manager Operaciones 20261114",
        role_id: 2,
        role: { id: 2, name: "manager" },
        company_id: 11,
        is_active: true,
        can_manage_work_reports: true,
        can_view_work_reports: true,
    };
}

function buildTask(overrides: Record<string, unknown> = {}) {
    return {
        id: 56,
        title: "QA Ciclo orden 20261112",
        description: null,
        notes: null,
        status: "pending",
        priority: "medium",
        unit: "service",
        pricing_mode: "fixed",
        price: 0,
        quantity: 1,
        location_id: 19,
        user_id: null as number | null,
        company_id: 11,
        is_invoiced: false,
        checklist_items: [],
        assignments: [],
        zones: [],
        spaces: [],
        created_at: "2026-11-12T10:00:00Z",
        updated_at: "2026-11-12T10:00:00Z",
        ...overrides,
    };
}

test.beforeEach(async ({ context, page }) => {
    test.skip(process.env.E2E_BASE_URL !== "http://localhost:3000", "Local UI regression only");
    await context.addCookies([{ name: "auth_token", value: makeToken(), url: "http://localhost:3000" }]);
    await page.addInitScript(() => localStorage.setItem("locale", "es"));
});

test("503 on tasks list shows error state with Retry instead of false empty board", async ({ page }) => {
    let failTasks = true;
    await page.route("**/api/v1/**", async (route) => {
        const url = new URL(route.request().url());
        const path = url.pathname.replace(/\/$/, "");
        if (path === "/api/v1/users/me") {
            return route.fulfill({ json: buildManager() });
        }
        if (path === "/api/v1/companies/11") {
            return route.fulfill({ json: { id: 11, name: "QA Company 11", onboarding_completed: true, subscription_status: "active" } });
        }
        if (path === "/api/v1/locations") {
            return route.fulfill({ json: [{ id: 19, name: "QA Ubicación Contrato 20261114", is_active: true, owner_company_id: 11, managing_company_id: 11 }] });
        }
        if (path === "/api/v1/users/assignable") {
            return route.fulfill({
                json: [
                    buildManager(),
                    { id: 43, email: "qa-task-worker-20261111@example.com", full_name: "QA Trabajadora tareas 20261111", is_active: true, role_id: 3, role: { id: 3, name: "viewer" }, company_id: 11 },
                ],
            });
        }
        if (path === "/api/v1/template-tasks") {
            return route.fulfill({ json: [] });
        }
        if (path === "/api/v1/task-items") {
            if (failTasks) {
                return route.fulfill({ status: 503, json: { detail: "Backend unavailable" } });
            }
            return route.fulfill({ json: [buildTask()] });
        }
        if (path === "/api/v1/work-sessions/active") {
            return route.fulfill({ json: null });
        }
        if (path.includes("alert-count")) {
            return route.fulfill({ json: { pending_requests: 0, pending_tasks: 0, unread_reports: 0 } });
        }
        if (path === "/api/v1/notifications/unread-count") {
            return route.fulfill({ json: { count: 0 } });
        }
        if (path === "/api/v1/task-reports") {
            return route.fulfill({ json: [] });
        }
        return route.fulfill({ json: [] });
    });

    await page.goto("/dashboard/tasks");
    await expect(page.getByRole("alert")).toBeVisible();
    const retryBtn = page.getByRole("button", { name: /Reintentar/i });
    await expect(retryBtn).toBeVisible();

    failTasks = false;
    await retryBtn.click();
    await expect(page.getByRole("button", { name: "Abrir tarea: QA Ciclo orden 20261112", exact: true })).toBeVisible();
});

test("manager can assign a worker directly when editing a general task", async ({ page }) => {
    let taskState = buildTask({ user_id: null });
    let capturedPatch: Record<string, unknown> | null = null;

    await page.route("**/api/v1/**", async (route) => {
        const url = new URL(route.request().url());
        const path = url.pathname.replace(/\/$/, "");
        if (path === "/api/v1/users/me") {
            return route.fulfill({ json: buildManager() });
        }
        if (path === "/api/v1/companies/11") {
            return route.fulfill({ json: { id: 11, name: "QA Company 11", onboarding_completed: true, subscription_status: "active" } });
        }
        if (path === "/api/v1/locations") {
            return route.fulfill({ json: [{ id: 19, name: "QA Ubicación Contrato 20261114", is_active: true, owner_company_id: 11, managing_company_id: 11 }] });
        }
        if (path === "/api/v1/users/assignable") {
            return route.fulfill({
                json: [
                    buildManager(),
                    { id: 43, email: "qa-task-worker-20261111@example.com", full_name: "QA Trabajadora tareas 20261111", is_active: true, role_id: 3, role: { id: 3, name: "viewer" }, company_id: 11 },
                ],
            });
        }
        if (path === "/api/v1/template-tasks") {
            return route.fulfill({ json: [] });
        }
        if (path === "/api/v1/task-items") {
            return route.fulfill({ json: [taskState] });
        }
        if (path === "/api/v1/task-items/56" && route.request().method() === "PATCH") {
            capturedPatch = JSON.parse(route.request().postData() || "{}");
            taskState = { ...taskState, user_id: Number(capturedPatch?.user_id) || null };
            return route.fulfill({ json: taskState });
        }
        if (path === "/api/v1/work-sessions/active") {
            return route.fulfill({ json: null });
        }
        if (path.includes("alert-count")) {
            return route.fulfill({ json: { pending_requests: 0, pending_tasks: 0, unread_reports: 0 } });
        }
        if (path === "/api/v1/notifications/unread-count") {
            return route.fulfill({ json: { count: 0 } });
        }
        return route.fulfill({ json: [] });
    });

    await page.goto("/dashboard/tasks");
    await page.getByRole("button", { name: "Abrir tarea: QA Ciclo orden 20261112", exact: true }).click();
    const assigneeSelect = page.locator("#task-edit-assignee");
    await expect(assigneeSelect).toBeVisible();
    await assigneeSelect.click();
    await page.getByRole("option", { name: "QA Trabajadora tareas 20261111" }).click();
    await page.getByRole("button", { name: /Guardar Cambios/i }).click();

    await expect.poll(() => capturedPatch?.user_id).toBe(43);
});
