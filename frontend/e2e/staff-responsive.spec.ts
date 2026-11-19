import { expect, test } from "@playwright/test";
import { base, employee, fixture } from "./fixtures/record-workspace";

test.beforeEach(() => test.skip(!/^http:\/\/(?:localhost|127\.0\.0\.1):(?:3000|3013)$/.test(base), "Local intercepted staff layout checks only"));
const history = { "2026-11": { cost: "2240", hours: "160" } };

for (const width of [390, 1024, 1440]) test(`staff consultation fits the available container at ${width}px`, async ({ context, page }, testInfo) => {
    await page.setViewportSize({ width, height: 1000 });
    const state = await fixture(context, page);
    const people = [9901, 9902, 9903].map(id => ({ ...employee(id, 1), history }));
    state.overrides.set("/api/v1/staff", () => people);
    state.overrides.set("/api/v1/staff/9901", () => people[0]);
    await page.goto("/dashboard/plantilla/trabajadores");
    const layout = page.locator("[data-staff-consultation]");
    await expect(layout).toBeVisible();
    const available = await layout.evaluate(element => element.clientWidth);
    const split = available >= 936;
    await expect(layout).toHaveAttribute("data-staff-consultation", split ? "split" : "dialog");
    if (!split) await expect(page.getByRole("dialog")).toHaveCount(0);
    await page.getByPlaceholder("Nombre, cargo o equipo").fill("Persona 9901");
    await page.getByLabel("Abrir ficha de Persona 9901 empresa 1", { exact: true }).filter({ visible: true }).click();
    const detail = split ? page.getByRole("complementary", { name: "Ficha del trabajador", exact: true }) : page.getByRole("dialog");
    await expect(detail.getByRole("heading", { name: "Persona 9901 empresa 1", exact: true })).toBeVisible();
    await expect(detail.getByText(/noviembre.*2026/i).first()).toBeVisible();
    await expect(detail.locator("figure")).toHaveCount(0);
    if (width === 390 || split) {
        const picker = detail.getByRole("combobox", { name: "Sección de la ficha del trabajador", exact: true });
        await expect(picker).toBeVisible(); await picker.click();
        for (const label of ["Información", "Costes", "Disponibilidad", "Documentos"]) await expect(page.getByRole("option", { name: label, exact: true })).toBeVisible();
        await page.getByRole("option", { name: "Información", exact: true }).click();
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath(`staff-${width}.png`), fullPage: split });
    await detail.getByRole("button", { name: "Cerrar ficha", exact: true }).click();
    await expect(page.getByPlaceholder("Nombre, cargo o equipo")).toHaveValue("Persona 9901");
    await expect(page.getByRole("dialog")).toHaveCount(0);
});

for (const width of [390, 1440]) test(`labour teams use the same consultation layout at ${width}px`, async ({ context, page }) => {
    await page.setViewportSize({ width, height: 1000 });
    const state = await fixture(context, page);
    state.overrides.set("/api/v1/staff", () => [employee(88, 1)]);
    state.overrides.set("/api/v1/work-crews", () => [{ id: 17, name: "Equipo Oficina QA", description: "Equipo de limpieza de oficinas", leader_employee_id: 88, employee_ids: [88], is_active: true }]);
    await page.goto("/dashboard/plantilla/equipos");
    const layout = page.locator("[data-staff-consultation]");
    await expect(layout).toBeVisible();
    const split = await layout.evaluate(element => element.clientWidth >= 936);
    await expect(layout).toHaveAttribute("data-staff-consultation", split ? "split" : "dialog");
    await page.getByLabel("Abrir equipo Equipo Oficina QA", { exact: true }).filter({ visible: true }).click();
    const detail = split ? page.getByRole("complementary", { name: "Ficha del equipo de trabajo", exact: true }) : page.getByRole("dialog");
    await expect(detail.getByRole("heading", { name: "Equipo Oficina QA", exact: true })).toBeVisible();
    await expect(detail.getByRole("link", { name: "Persona 88 empresa 1", exact: true })).toHaveAttribute("href", "/dashboard/plantilla/trabajadores?employeeId=88");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await detail.getByRole("button", { name: "Cerrar equipo", exact: true }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
});
