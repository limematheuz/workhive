import { expect, test } from "@playwright/test";
import { setupNotificationWorkspace } from "./helpers/notification-workspace";

for (const width of [390, 1440]) for (const scenario of ["operations", "scoped", "empty"] as const) test(`task planning follows ${scenario} permissions at ${width}px`, async ({ context, page }) => {
    test.skip(process.env.E2E_BASE_URL !== "http://localhost:3000", "Local UI regression only");
    await page.setViewportSize({ width, height: 1000 });
    await setupNotificationWorkspace(context, page, true, "/dashboard/tasks", { hasTasks: false });
    await page.route("**/api/v1/users/me", route => route.fulfill({ json: {
        id: 1, company_id: 1, full_name: "QA planning", is_active: true,
        role: { name: scenario === "operations" ? "viewer" : "manager" },
        can_manage_tasks: scenario !== "empty", can_view_tasks: scenario !== "empty",
        can_view_locations: true, can_manage_service_catalog: scenario === "operations",
    } }));
    await page.route("**/api/v1/locations/**", route => route.fulfill({ json: [
        { id: 15, name: "QA solo lectura", address: "QA", city: "QA", owner_company_id: 1, can_manage_tasks: false, can_manage_reservations: false },
        { id: 16, name: "QA tarea permitida", address: "QA", city: "QA", owner_company_id: 1, can_manage_tasks: true, can_manage_reservations: false },
    ] }));
    await page.route("**/api/v1/users/assignable**", route => route.fulfill({ json: [] }));
    await page.route("**/api/v1/template-tasks/**", route => route.fulfill({ json: [] }));
    await page.reload();
    await expect(page.getByRole("heading", { name: "Tablero Operativo de Campo", exact: true })).toBeVisible();
    const create = page.getByRole("button", { name: "Nueva Tarea", exact: true });
    if (scenario === "empty") {
        await expect(create).toHaveCount(0);
        await expect(page.getByRole("tab", { name: "Catálogo de servicios", exact: true })).toHaveCount(0);
    } else {
        await expect(create).toBeVisible();
        if (await page.getByRole("combobox", { name: "Seleccionar sección", exact: true }).count()) {
            await page.getByRole("combobox", { name: "Seleccionar sección", exact: true }).click();
            await expect(page.getByRole("option", { name: "Catálogo de servicios", exact: true })).toHaveCount(scenario === "operations" ? 1 : 0);
            await page.keyboard.press("Escape");
        } else {
            await expect(page.getByRole("tab", { name: "Catálogo de servicios", exact: true })).toHaveCount(scenario === "operations" ? 1 : 0);
        }
        await create.click();
        await page.getByRole("dialog").locator("#task-create-location").click();
        await expect(page.getByRole("option", { name: "QA tarea permitida", exact: true })).toBeVisible();
        await expect(page.getByRole("option", { name: "QA solo lectura", exact: true })).toHaveCount(0);
    }
});
