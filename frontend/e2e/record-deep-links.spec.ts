import { expect, test } from "@playwright/test";
import { base, fixture } from "./fixtures/record-workspace";

test.beforeEach(() => test.skip(!/^http:\/\/(?:localhost|127\.0\.0\.1):(?:3000|3013)$/.test(base), "Local intercepted deep-link checks only"));

test("staff links load the exact authorized record outside the list and preserve filters on close", async ({ context, page }) => {
    const state = await fixture(context, page);
    await page.goto("/dashboard/plantilla/trabajadores?employeeId=9901");
    await expect(page.getByRole("heading", { name: "Persona 9901 empresa 1", exact: true })).toBeVisible();
    expect(state.reads).toContain("/api/v1/staff/9901");
    await page.getByPlaceholder("Nombre, cargo o equipo").fill("Conservar filtro");
    await page.getByRole("button", { name: "Cerrar ficha", exact: true }).click();
    await expect(page).toHaveURL(/\/trabajadores$/);
    await expect(page.getByPlaceholder("Nombre, cargo o equipo")).toHaveValue("Conservar filtro");
});

test("an invalid staff identifier never issues a detail request", async ({ context, page }) => {
    const state = await fixture(context, page);
    await page.goto("/dashboard/plantilla/trabajadores?employeeId=bad");
    await expect(page.getByRole("alert").filter({ hasText: "El identificador del enlace no es válido" })).toBeVisible();
    expect(state.reads.some(path => /^\/api\/v1\/staff\//.test(path))).toBe(false);
});

test("staff responses from the previous company cannot replace the active company record", async ({ context, page }) => {
    const state = await fixture(context, page);
    let release!: () => void;
    state.holds.set("/api/v1/staff/9901", new Promise(resolve => { release = resolve; }));
    await page.goto("/dashboard/plantilla/trabajadores?employeeId=9901");
    await expect.poll(() => state.reads.includes("/api/v1/staff/9901")).toBe(true);
    state.company = 2;
    await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent("pageshow", { persisted: true })));
    await expect(page.getByRole("heading", { name: "Persona 9901 empresa 2", exact: true })).toBeVisible();
    release(); await page.waitForTimeout(100);
    await expect(page.getByRole("heading", { name: "Persona 9901 empresa 1", exact: true })).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "Persona 9901 empresa 2", exact: true })).toBeVisible();
});

test("clock links load an own historical record outside the latest page", async ({ context, page }) => {
    const state = await fixture(context, page);
    await page.goto("/worker/clock?sessionId=9901&view=history");
    await expect(page.getByRole("dialog")).toContainText("Fichaje #9901");
    await expect(page.getByRole("dialog")).toContainText("110 min");
    expect(state.reads).toContain("/api/v1/work-sessions/9901");
    await page.getByRole("button", { name: "Volver a mis fichajes", exact: true }).click();
    await expect(page).toHaveURL(/\/worker\/clock\?view=history$/);
});

test("clock detail errors preserve the page and offer an exact retry", async ({ context, page }) => {
    const state = await fixture(context, page); state.notFound.add("/api/v1/work-sessions/9901");
    await page.goto("/worker/clock?sessionId=9901");
    await expect(page.getByRole("alert").filter({ hasText: "Error fetching work session details" })).toBeVisible();
    state.notFound.clear();
    await page.getByRole("button", { name: "Reintentar", exact: true }).click();
    await expect(page.getByRole("dialog")).toContainText("Fichaje #9901");
});

test("quality uses incident permissions despite a false generic flag and keeps active filters", async ({ context, page }) => {
    await fixture(context, page);
    await page.goto("/dashboard/quality?tab=incidents&status=active&incidentId=9901");
    await expect(page.getByRole("dialog")).toContainText("Incidencia 9901");
    await page.getByRole("dialog").getByRole("button", { name: "Cerrar", exact: true }).click();
    await expect(page).toHaveURL(/\/quality\?tab=incidents&status=active$/);
    await expect(page.getByText("Incidencia 401", { exact: true }).filter({ visible: true })).toBeVisible();
    await expect(page.getByText("Incidencia 402", { exact: true }).filter({ visible: true })).toBeVisible();
    await expect(page.getByText("Incidencia 403", { exact: true })).toHaveCount(0);
    await expect(page.getByText("Incidencia 404", { exact: true })).toHaveCount(0);
});

test("quality never loads incident collections or details when can_read is false", async ({ context, page }) => {
    const state = await fixture(context, page); state.incidents = false;
    await page.goto("/dashboard/quality?tab=incidents&incidentId=9901");
    await expect(page.getByRole("heading", { name: "Calidad restringida", exact: true })).toBeVisible();
    expect(state.reads.some(path => path.startsWith("/api/v1/quality/incidents"))).toBe(false);
});

test("an older incident response cannot replace the new URL selection", async ({ context, page }) => {
    const state = await fixture(context, page);
    let release!: () => void;
    state.holds.set("/api/v1/quality/incidents/9901", new Promise(resolve => { release = resolve; }));
    await page.goto("/dashboard/quality?tab=incidents&status=active&incidentId=9901");
    await expect.poll(() => state.reads.includes("/api/v1/quality/incidents/9901")).toBe(true);
    await page.evaluate(() => history.pushState(null, "", "/dashboard/quality?tab=incidents&status=active&incidentId=9902"));
    await expect(page.getByRole("dialog")).toContainText("Incidencia 9902");
    release(); await page.waitForTimeout(100);
    await expect(page.getByRole("dialog")).toContainText("Incidencia 9902");
    await expect(page.getByRole("dialog")).not.toContainText("Incidencia 9901");
});
