import { expect, test } from "@playwright/test";
import { base, employee, fixture } from "./fixtures/record-workspace";

test.beforeEach(() => test.skip(!/^http:\/\/(?:localhost|127\.0\.0\.1):(?:3000|3013)$/.test(base), "Local intercepted company-context checks only"));

test("authorized shifts survive a missing location-read capability", async ({ context, page }) => {
    const state = await fixture(context, page); state.permissions["work.read"] = true;
    state.permissions["time.manage"] = false;
    state.overrides.set("/api/v1/staff", company => [employee(88, company)]);
    state.overrides.set("/api/v1/staff-shifts", () => [{ id: 17, employee_id: 88, effective_employee_id: 88, location_id: 7,
        task_id: null, starts_at: "2026-11-18T10:00:00Z", ends_at: "2026-11-18T12:00:00Z", coverage: "Titular" }]);
    state.denied.add("/api/v1/locations");
    await page.goto("/dashboard/plantilla/turnos");
    await expect(page.getByText("Persona 88 empresa 1", { exact: true })).toBeVisible();
    await expect(page.getByText(/Ubicación #7/)).toBeVisible();
    expect(state.reads).toContain("/api/v1/staff-shifts");
    expect(state.reads).not.toContain("/api/v1/locations");
});

test("a labour-only profile gets a permission explanation instead of a false empty shift list", async ({ context, page }) => {
    const state = await fixture(context, page);
    state.permissions["time.manage"] = false;
    await page.goto("/dashboard/plantilla/turnos");
    await expect(page.getByRole("status").filter({ hasText: "Necesitas permiso de lectura de trabajos" })).toBeVisible();
    await expect(page.getByText("Sin turnos programados.", { exact: true })).toHaveCount(0);
    expect(state.reads).not.toContain("/api/v1/staff-shifts");
});

test("profile activity 403s never block personal identity or the account editor", async ({ context, page }) => {
    const state = await fixture(context, page);
    state.permissions["work.read"] = state.permissions["locations.read"] = true;
    state.denied.add("/api/v1/work-sessions"); state.denied.add("/api/v1/locations");
    state.overrides.set("/api/v1/users/8011/stats", () => ({ total_hours_worked: 17.5, total_tasks: 4,
        tasks_completed: 3, tasks_pending: 1, locations_worked_count: 2, active_session_id: null }));
    await page.goto("/dashboard/profile");
    await expect(page.getByRole("heading", { name: "Cuenta QA", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Reintentar actividad", exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Editar Datos", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Configuración de Cuenta", exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Error", exact: true })).toHaveCount(0);
});

test("organization records disappear immediately when the active company changes", async ({ context, page }) => {
    const state = await fixture(context, page); state.permissions["access.members.read"] = true;
    state.overrides.set("/api/v1/organization/members", company => [{ id: company, user_id: 500 + company,
        full_name: `Acceso software empresa ${company}`, email: `member${company}@example.test`, access_class: "worker", status: "active",
        ended_at: null, is_anonymized: false, legacy_role_name: "viewer", department_ids: [], team_ids: [], profile_assignments: [] }]);
    await page.goto("/dashboard/organization");
    await expect(page.getByText("Acceso software empresa 1", { exact: true }).first()).toBeVisible();
    let release!: () => void;
    state.holds.set("/api/v1/organization/members", new Promise(resolve => { release = resolve; }));
    state.company = 2;
    await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent("pageshow", { persisted: true })));
    await expect.poll(() => state.reads.filter(path => path === "/api/v1/organization/members").length).toBe(2);
    await expect(page.getByText("Acceso software empresa 1", { exact: true })).toHaveCount(0);
    release();
    await expect(page.getByText("Acceso software empresa 2", { exact: true }).first()).toBeVisible();
});
