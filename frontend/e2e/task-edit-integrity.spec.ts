import { expect, test, type Page, type BrowserContext } from "@playwright/test";

test.beforeEach(() => {
    test.skip(process.env.E2E_BASE_URL !== "http://localhost:3000", "Local UI regression only");
});

async function openEditor(context: BrowserContext, page: Page, width: number, scheduled: string | null = null, checkout: string | null = null, fromList = false, pricing: { unit?: string; locked?: boolean } = {}) {
    await page.setViewportSize({ width, height: 900 });
    const token = Buffer.from(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600 })).toString("base64url");
    await context.addCookies([{ name: "auth_token", value: `fixture.${token}.not-a-backend-token`, url: "http://localhost:3000" }]);
    await page.addInitScript(() => localStorage.setItem("locale", "es"));
    const task = {
        id: 1, title: "QA integridad edición", description: "- [ ] Comprobar acceso QA",
        unit: pricing.unit || "service", price: 1, quantity: 1, pricing_mode: "fixed", status: "pending",
        pricing_locked_at: pricing.locked ? new Date().toISOString() : null,
        billing_pricing_mode_snapshot: pricing.locked ? "fixed" : null,
        billing_unit_snapshot: pricing.locked ? pricing.unit : null,
        billing_price_snapshot: pricing.locked ? 1 : null,
        billing_quantity_snapshot: pricing.locked ? 1 : null,
        priority: "low", company_id: 1, location_id: 1, user_id: null,
        created_at: new Date().toISOString(), scheduled_start_at: scheduled, due_at: null,
        checklist_items: [{ id: 1, position: 0, text: "Comprobar acceso QA", completed: false, assignments: [] }],
        assignments: [],
        checkout_reservation: checkout ? { id: 1, check_out_at: checkout, owner_company_id: 1 } : null,
    };
    const updates: Record<string, unknown>[] = [];
    await page.route("**/api/v1/**", async route => {
        const path = new URL(route.request().url()).pathname.replace(/\/$/, "");
        let body: unknown = [];
        if (path === "/api/v1/users/me") body = { id: 1, full_name: "QA Admin", role: { name: "admin" }, company_id: 1, is_active: true };
        else if (path === "/api/v1/users") body = [{ id: 1, full_name: "QA Admin", email: "qa@example.test", is_active: true }];
        else if (path === "/api/v1/companies/1") body = { id: 1, name: "QA", onboarding_completed: true, subscription_status: "active" };
        else if (path === "/api/v1/task-items") body = [task];
        else if (path === "/api/v1/task-items/1") {
            if (route.request().method() === "PATCH") {
                const payload = route.request().postDataJSON();
                updates.push(payload);
                Object.assign(task, payload);
            }
            body = task;
        }
        else if (path === "/api/v1/locations") body = [{ id: 1, name: "QA ubicación", address: "QA", city: "QA", is_active: true }];
        else if (path === "/api/v1/work-sessions/active") body = null;
        else if (path.includes("alert-count")) body = { pending_requests: 0, pending_tasks: 0, unread_reports: 0 };
        await route.fulfill({ json: body });
    });
    await page.goto("/dashboard/tasks");
    if (fromList) {
        if (width >= 1024) await page.getByRole("tab", { name: "Lista", exact: true }).click();
        else {
            await page.getByRole("combobox", { name: "Seleccionar sección", exact: true }).click();
            await page.getByRole("option", { name: "Lista", exact: true }).click();
        }
    }
    await page.getByRole("button", { name: fromList ? task.title : `Abrir tarea: ${task.title}`, exact: true }).click();
    const dialog = page.getByRole("dialog", { name: /QA integridad edición/ });
    await expect(dialog).toBeVisible();
    return { dialog, updates };
}

for (const width of [1440, 768, 390]) {
    test(`unplanned task stays unplanned after editing notes at ${width}px`, async ({ context, page }) => {
        const { dialog, updates } = await openEditor(context, page, width);
        await expect(dialog.locator("#task-edit-date")).toHaveValue("");
        await expect(dialog.locator("#task-edit-time")).toHaveValue("");
        await dialog.locator("#task-edit-notes").fill("QA nota sin planificación");
        await dialog.getByRole("button", { name: /guardar cambios/i }).click();
        await expect(dialog).toHaveCount(0);
        expect(updates).toHaveLength(1);
        expect(updates[0].scheduled_start_at).toBeNull();
        expect(updates[0].notes).toBe("QA nota sin planificación");
    });

    test(`same assignment closes without discard at ${width}px`, async ({ context, page }) => {
        const { dialog, updates } = await openEditor(context, page, width);
        await dialog.getByRole("combobox", { name: "Asignar trabajador: Comprobar acceso QA", exact: true }).click();
        await page.getByRole("option", { name: "Sin asignar", exact: true }).click();
        await dialog.getByRole("button", { name: "Close", exact: true }).click();
        await expect(page.getByRole("alertdialog")).toHaveCount(0);
        await expect(dialog).toHaveCount(0);
        expect(updates).toHaveLength(0);
    });
    test(`unchanged planning keeps seconds and offset at ${width}px`, async ({ context, page }) => {
        const scheduled = "2050-06-10T09:12:43.123456+00:00";
        const { dialog, updates } = await openEditor(context, page, width, scheduled, scheduled);
        await dialog.locator("#task-edit-notes").fill("QA precisión");
        await dialog.getByRole("button", { name: /guardar cambios/i }).click();
        await expect(dialog).toHaveCount(0);
        expect(updates).toHaveLength(1);
        expect(updates[0].scheduled_start_at).toBe(scheduled);
    });

    test(`planning can be set, changed to date only and removed at ${width}px`, async ({ context, page }) => {
        const { dialog, updates } = await openEditor(context, page, width);
        await dialog.locator("#task-edit-date").fill("10/06/2050");
        await dialog.locator("#task-edit-time").fill("10:30");
        await dialog.getByRole("button", { name: /guardar cambios/i }).click();
        await expect(dialog).toHaveCount(0);
        const expected = new Date(2050, 5, 10, 10, 30).toISOString();
        expect(updates[0].scheduled_start_at).toBe(expected);
        await page.getByRole("button", { name: "Abrir tarea: QA integridad edición", exact: true }).click();
        await dialog.locator("#task-edit-time").fill("");
        await dialog.getByRole("button", { name: /guardar cambios/i }).click();
        await expect(dialog).toHaveCount(0);
        expect(updates[1].scheduled_start_at).toBe("2050-06-10T00:00:00.000Z");
        await page.getByRole("button", { name: "Abrir tarea: QA integridad edición", exact: true }).click();
        await expect(dialog.locator("#task-edit-time")).toHaveValue("");
        await dialog.locator("#task-edit-date").fill("");
        await dialog.getByRole("button", { name: /guardar cambios/i }).click();
        await expect(dialog).toHaveCount(0);
        expect(updates[2].scheduled_start_at).toBeNull();
    });

    test(`changed assignment is guarded and can be saved at ${width}px`, async ({ context, page }) => {
        const { dialog, updates } = await openEditor(context, page, width);
        await dialog.getByRole("combobox", { name: "Asignar trabajador: Comprobar acceso QA", exact: true }).click();
        await page.getByRole("option", { name: "QA Admin", exact: true }).click();
        await dialog.getByRole("button", { name: "Close", exact: true }).click();
        await expect(page.getByRole("alertdialog")).toBeVisible();
        await page.getByRole("button", { name: "Seguir editando", exact: true }).click();
        await dialog.getByRole("button", { name: /guardar cambios/i }).click();
        await expect(dialog).toHaveCount(0);
        expect(updates).toHaveLength(1);
        expect(updates[0].description).toContain("(@1:QA Admin)");
    });

    test(`bulk no-op closes cleanly at ${width}px`, async ({ context, page }) => {
        const { dialog, updates } = await openEditor(context, page, width);
        await dialog.getByRole("combobox", { name: "Asignar todos los pasos", exact: true }).click();
        await page.getByRole("option", { name: "Quitar asignación", exact: true }).click();
        await dialog.getByRole("button", { name: "Close", exact: true }).click();
        await expect(page.getByRole("alertdialog")).toHaveCount(0);
        await expect(dialog).toHaveCount(0);
        expect(updates).toHaveLength(0);
    });

    test(`checklist toggle still warns before discarding at ${width}px`, async ({ context, page }) => {
        const { dialog, updates } = await openEditor(context, page, width);
        await dialog.getByRole("button", { name: "Comprobar acceso QA", exact: true }).click();
        await dialog.getByRole("button", { name: "Close", exact: true }).click();
        await expect(page.getByRole("alertdialog")).toBeVisible();
        await page.getByRole("button", { name: "Salir sin guardar", exact: true }).click();
        await expect(dialog).toHaveCount(0);
        expect(updates).toHaveLength(0);
    });

    test(`same assignment does not clear a note draft at ${width}px`, async ({ context, page }) => {
        const { dialog, updates } = await openEditor(context, page, width);
        await dialog.locator("#task-edit-notes").fill("QA borrador pendiente");
        await dialog.getByRole("combobox", { name: "Asignar trabajador: Comprobar acceso QA", exact: true }).click();
        await page.getByRole("option", { name: "Sin asignar", exact: true }).click();
        await dialog.getByRole("button", { name: "Close", exact: true }).click();
        await expect(page.getByRole("alertdialog")).toBeVisible();
        expect(updates).toHaveLength(0);
    });

    test(`bulk assignment and checkbox changes are guarded at ${width}px`, async ({ context, page }) => {
        const { dialog, updates } = await openEditor(context, page, width);
        await dialog.getByRole("combobox", { name: "Asignar todos los pasos", exact: true }).click();
        await page.getByRole("option", { name: "QA Admin", exact: true }).click();
        await dialog.getByRole("button", { name: "Close", exact: true }).click();
        await expect(page.getByRole("alertdialog")).toBeVisible();
        await page.getByRole("button", { name: "Seguir editando", exact: true }).click();
        await dialog.getByRole("button", { name: "Marcar completado: Comprobar acceso QA", exact: true }).click();
        await dialog.getByRole("button", { name: "Close", exact: true }).click();
        await expect(page.getByRole("alertdialog")).toBeVisible();
        expect(updates).toHaveLength(0);
    });

    test(`list editing preserves the original checklist at ${width}px`, async ({ context, page }) => {
        const { dialog, updates } = await openEditor(context, page, width, null, null, true);
        await expect(dialog.getByRole("button", { name: "Marcar completado: Comprobar acceso QA", exact: true })).toBeVisible();
        const text = await dialog.getByRole("button", { name: "Comprobar acceso QA", exact: true }).boundingBox();
        const selector = await dialog.getByRole("combobox", { name: "Asignar trabajador: Comprobar acceso QA", exact: true }).boundingBox();
        expect(text).not.toBeNull();
        expect(selector).not.toBeNull();
        if (width < 640) expect(text!.y + text!.height).toBeLessThanOrEqual(selector!.y);
        else expect(text!.x + text!.width).toBeLessThanOrEqual(selector!.x);
        // Radix's clipped native selects contribute to scrollWidth; check the visible controls.
        const bounds = await dialog.boundingBox();
        expect(bounds).not.toBeNull();
        expect(selector!.x).toBeGreaterThanOrEqual(bounds!.x);
        expect(selector!.x + selector!.width).toBeLessThanOrEqual(bounds!.x + bounds!.width);
        await dialog.locator("#task-edit-notes").fill("QA nota desde lista");
        await dialog.getByRole("button", { name: /guardar cambios/i }).click();
        await expect(dialog).toHaveCount(0);
        expect(updates).toHaveLength(1);
        expect(updates[0].description).toBe("- [ ] Comprobar acceso QA");
        expect(updates[0].scheduled_start_at).toBeNull();
    });

    for (const pricing of [{ unit: "servicio", locked: false }, { unit: "service", locked: false }, { unit: "servicio", locked: true }]) {
        test(`existing unit ${pricing.unit} locked=${pricing.locked} is visible and preserved at ${width}px`, async ({ context, page }) => {
            const { dialog, updates } = await openEditor(context, page, width, null, null, false, pricing);
            const unit = dialog.locator("#task-edit-unit");
            await expect(unit).toContainText(pricing.unit);
            if (pricing.locked) await expect(unit).toBeDisabled();
            await dialog.locator("#task-edit-notes").fill("QA unidad conservada");
            await dialog.getByRole("button", { name: /guardar cambios/i }).click();
            await expect(dialog).toHaveCount(0);
            expect(updates).toHaveLength(1);
            if (pricing.locked) expect(updates[0]).not.toHaveProperty("unit");
            else expect(updates[0].unit).toBe(pricing.unit);
        });
    }

}
