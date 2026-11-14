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
    const mainAlert = page.locator("main").getByRole("alert");
    await expect(mainAlert).toBeVisible();
    await expect(mainAlert).toContainText("No se pudieron cargar las tareas.");
    const retryBtn = mainAlert.getByRole("button", { name: "Reintentar", exact: true });
    await expect(retryBtn).toBeVisible();

    await page.getByRole("button", { name: "Cambiar idioma a inglés", exact: true }).click();
    await expect(mainAlert).toContainText("Could not load tasks.");
    await expect(mainAlert.getByRole("button", { name: "Retry", exact: true })).toBeVisible();

    await page.getByRole("button", { name: "Cambiar idioma a español", exact: true }).click();
    await expect(mainAlert).toContainText("No se pudieron cargar las tareas.");

    failTasks = false;
    await retryBtn.click();
    await expect(page.getByRole("button", { name: "Abrir tarea: QA Ciclo orden 20261112", exact: true })).toBeVisible();
});

test("revoking task read clears board on SSE/polling while transient 5xx preserves same-context snapshot", async ({ page }) => {
    let taskStatusMode: "ok" | "503" | "403" | "401" = "ok";
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
            return route.fulfill({ json: [buildManager()] });
        }
        if (path === "/api/v1/template-tasks") {
            return route.fulfill({ json: [] });
        }
        if (path === "/api/v1/task-items") {
            if (taskStatusMode === "503") {
                return route.fulfill({ status: 503, json: { detail: "Temporary outage" } });
            }
            if (taskStatusMode === "403") {
                return route.fulfill({ status: 403, json: { detail: "Forbidden" } });
            }
            if (taskStatusMode === "401") {
                return route.fulfill({ status: 401, json: { detail: "Unauthorized" } });
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
        return route.fulfill({ json: [] });
    });

    await page.goto("/dashboard/tasks");
    const taskButton = page.getByRole("button", { name: "Abrir tarea: QA Ciclo orden 20261112", exact: true });
    await expect(taskButton).toBeVisible();

    // 1. Transient 503 on SSE invalidation preserves same-context snapshot and shows warning banner
    taskStatusMode = "503";
    await page.evaluate(() => {
        window.dispatchEvent(new CustomEvent("workhive:realtime-invalidation", { detail: ["tasks"] }));
    });
    const mainAlert = page.locator("main").getByRole("alert");
    await expect(mainAlert).toContainText("No se pudieron cargar las tareas.");
    await expect(taskButton).toBeVisible();

    // 2. Revoking read with 403 on SSE invalidation clears the confidential snapshot immediately
    taskStatusMode = "403";
    await page.evaluate(() => {
        window.dispatchEvent(new CustomEvent("workhive:realtime-invalidation", { detail: ["tasks"] }));
    });
    await expect(taskButton).toHaveCount(0);
    await expect(mainAlert).toContainText("No tienes permiso para consultar estas tareas.");

    // 3. Recovery then background polling (focus) 403 revocation also clears the board
    taskStatusMode = "ok";
    await mainAlert.getByRole("button", { name: "Reintentar", exact: true }).click();
    await expect(taskButton).toBeVisible();

    taskStatusMode = "403";
    await page.evaluate(() => {
        window.dispatchEvent(new Event("focus"));
    });
    await expect(taskButton).toHaveCount(0);
    await expect(mainAlert).toContainText("No tienes permiso para consultar estas tareas.");

    // 4. Recovery then 401 revocation also clears the board immediately
    taskStatusMode = "ok";
    await mainAlert.getByRole("button", { name: "Reintentar", exact: true }).click();
    await expect(taskButton).toBeVisible();

    taskStatusMode = "401";
    await page.evaluate(() => {
        window.dispatchEvent(new CustomEvent("workhive:realtime-invalidation", { detail: ["tasks"] }));
    });
    await expect(taskButton).toHaveCount(0);
});

test("switching identity/company clears previous company snapshot even if new company read fails with 503", async ({ page }) => {
    let activeCompany = 11;
    await page.route("**/api/v1/**", async (route) => {
        const url = new URL(route.request().url());
        const path = url.pathname.replace(/\/$/, "");
        if (path === "/api/v1/users/me") {
            if (activeCompany === 11) {
                return route.fulfill({ json: buildManager() });
            }
            return route.fulfill({
                json: {
                    ...buildManager(),
                    id: 99,
                    company_id: 7,
                    email: "qa-other-company@example.com",
                },
            });
        }
        if (path === "/api/v1/companies/11" || path === "/api/v1/companies/7") {
            return route.fulfill({ json: { id: activeCompany, name: `QA Company ${activeCompany}`, onboarding_completed: true, subscription_status: "active" } });
        }
        if (path === "/api/v1/locations") {
            return route.fulfill({ json: [{ id: 19, name: "QA Ubicación Contrato 20261114", is_active: true, owner_company_id: activeCompany, managing_company_id: activeCompany }] });
        }
        if (path === "/api/v1/users/assignable") {
            return route.fulfill({ json: [buildManager()] });
        }
        if (path === "/api/v1/template-tasks") {
            return route.fulfill({ json: [] });
        }
        if (path === "/api/v1/task-items") {
            if (activeCompany === 7) {
                return route.fulfill({ status: 503, json: { detail: "Unavailable" } });
            }
            return route.fulfill({ json: [buildTask({ title: "Tarea Confidencial Empresa 11" })] });
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
    const company11Task = page.getByRole("button", { name: "Abrir tarea: Tarea Confidencial Empresa 11", exact: true });
    await expect(company11Task).toBeVisible();

    activeCompany = 7;
    await page.evaluate(() => {
        window.dispatchEvent(new PageTransitionEvent("pageshow", { persisted: true }));
    });
    await expect(company11Task).toHaveCount(0);
    await expect(page.locator("main").getByRole("alert")).toContainText("No se pudieron cargar las tareas.");
});

test("late out-of-order task response from previous tab/filter does not overwrite current filter", async ({ page }) => {
    let releaseSlowKanban: (() => void) | null = null;
    let kanbanCalls = 0;

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
            return route.fulfill({
                json: [
                    { id: 19, name: "Ubicación A", is_active: true, owner_company_id: 11, managing_company_id: 11 },
                    { id: 20, name: "Ubicación B", is_active: true, owner_company_id: 11, managing_company_id: 11 },
                ],
            });
        }
        if (path === "/api/v1/users/assignable") {
            return route.fulfill({ json: [buildManager()] });
        }
        if (path === "/api/v1/template-tasks") {
            return route.fulfill({ json: [] });
        }
        if (path === "/api/v1/task-items") {
            const locId = url.searchParams.get("location_id");
            if (locId === "19") {
                await new Promise<void>((resolve) => {
                    releaseSlowKanban = resolve;
                });
                return route.fulfill({ json: [buildTask({ id: 101, title: "Tarea Lenta Ubicación A", location_id: 19 })] });
            }
            if (locId === "20") {
                return route.fulfill({ json: [buildTask({ id: 102, title: "Tarea Rápida Ubicación B", location_id: 20 })] });
            }
            kanbanCalls += 1;
            return route.fulfill({ json: [buildTask({ id: 100 + kanbanCalls, title: "Tarea Inicial General" })] });
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
    await expect(page.getByRole("button", { name: "Abrir tarea: Tarea Inicial General", exact: true })).toBeVisible();

    await page.getByRole("tab", { name: "Lista" }).click();
    const locationFilter = page.getByRole("combobox", { name: /Filtrar por ubicación/i });
    await locationFilter.click();
    await page.getByRole("option", { name: "Ubicación A" }).click();

    await expect.poll(() => releaseSlowKanban !== null).toBe(true);

    await locationFilter.click();
    await page.getByRole("option", { name: "Ubicación B" }).click();
    await expect(page.getByText("Tarea Rápida Ubicación B")).toBeVisible();

    // Release slow response for Ubicación A; it must be ignored
    releaseSlowKanban!();
    await page.waitForTimeout(150);
    await expect(page.getByText("Tarea Rápida Ubicación B")).toBeVisible();
    await expect(page.getByText("Tarea Lenta Ubicación A")).toHaveCount(0);
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

test("assignable directory 503 fails closed with Retry instead of silently masking as [currentUser], and paginates >200 candidates", async ({ page }) => {
    let failDirectory = true;
    const page1Users = Array.from({ length: 200 }, (_, idx) => ({
        id: 1000 + idx,
        email: `worker-${idx}@example.com`,
        full_name: `Trabajador Pag1 ${idx}`,
        is_active: true,
        role_id: 3,
        role: { id: 3, name: "viewer" },
        company_id: 11,
    }));
    const page2User = {
        id: 2500,
        email: "worker-page2@example.com",
        full_name: "Trabajadora Página 2",
        is_active: true,
        role_id: 3,
        role: { id: 3, name: "viewer" },
        company_id: 11,
    };

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
            if (failDirectory) {
                return route.fulfill({ status: 503, json: { detail: "Directory unavailable" } });
            }
            const skip = Number(url.searchParams.get("skip") || "0");
            return route.fulfill({ json: skip === 0 ? page1Users : [page2User] });
        }
        if (path === "/api/v1/template-tasks") {
            return route.fulfill({ json: [] });
        }
        if (path === "/api/v1/task-items") {
            return route.fulfill({ json: [buildTask({ user_id: 2500 })] });
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
    const mainAlert = page.locator("main").getByRole("alert");
    await expect(mainAlert).toContainText("No se pudieron cargar las tareas.");

    failDirectory = false;
    await mainAlert.getByRole("button", { name: "Reintentar", exact: true }).click();
    await expect(page.getByRole("button", { name: "Abrir tarea: QA Ciclo orden 20261112", exact: true })).toBeVisible();

    await page.getByRole("tab", { name: "Lista" }).click();
    await expect(page.getByText("Trabajadora Página 2")).toBeVisible();
});
