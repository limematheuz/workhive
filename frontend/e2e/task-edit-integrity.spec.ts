import { expect, test, type Page, type BrowserContext } from "@playwright/test";

test.beforeEach(() => {
    test.skip(process.env.E2E_BASE_URL !== "http://localhost:3000", "Local UI regression only");
});

async function openEditor(context: BrowserContext, page: Page, width: number, scheduled: string | null = null, checkout: string | null = null, fromList = false, pricing: { unit?: string; locked?: boolean; completed?: boolean; structuredOnly?: boolean } = {}) {
    await page.setViewportSize({ width, height: 900 });
    const token = Buffer.from(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600 })).toString("base64url");
    await context.addCookies([{ name: "auth_token", value: `fixture.${token}.not-a-backend-token`, url: "http://localhost:3000" }]);
    await page.addInitScript(() => localStorage.setItem("locale", "es"));
    const task = {
        id: 1, title: "QA integridad edición", description: pricing.structuredOnly ? "Instrucciones de espacio QA" : pricing.completed ? "- [x] Comprobar acceso QA (@1:QA Admin:completed)" : "- [ ] Comprobar acceso QA",
        unit: pricing.unit || "service", price: 1, quantity: 1, pricing_mode: "fixed", status: pricing.completed ? "completed" : "pending",
        pricing_locked_at: pricing.locked ? new Date().toISOString() : null,
        billing_pricing_mode_snapshot: pricing.locked ? "fixed" : null,
        billing_unit_snapshot: pricing.locked ? pricing.unit : null,
        billing_price_snapshot: pricing.locked ? 1 : null,
        billing_quantity_snapshot: pricing.locked ? 1 : null,
        priority: "low", company_id: 1, location_id: 1, user_id: null,
        created_at: new Date().toISOString(), scheduled_start_at: scheduled, due_at: null,
        checklist_items: [{ id: 1, position: 0, text: "Comprobar acceso QA", completed: Boolean(pricing.completed), assignments: [] }],
        assignments: [],
        checkout_reservation: checkout ? { id: 1, check_out_at: checkout, owner_company_id: 1 } : null,
    };
    const updates: Record<string, unknown>[] = [];
    const creations: Record<string, unknown>[] = [];
    await page.route("**/api/v1/**", async route => {
        const path = new URL(route.request().url()).pathname.replace(/\/$/, "");
        let body: unknown = [];
        if (path === "/api/v1/users/me") body = { id: 1, full_name: "QA Admin", role: { name: "admin" }, company_id: 1, is_active: true };
        else if (path === "/api/v1/users") body = [{ id: 1, full_name: "QA Admin", email: "qa@example.test", is_active: true }];
        else if (path === "/api/v1/companies/1") body = { id: 1, name: "QA", onboarding_completed: true, subscription_status: "active" };
        else if (path === "/api/v1/task-items") {
            if (route.request().method() === "POST") {
                const payload = route.request().postDataJSON();
                creations.push(payload);
                body = { ...task, ...payload, id: 2, status: "pending" };
            } else body = [task];
        }
        else if (path === "/api/v1/task-items/1/duplicate") {
            creations.push({ method: route.request().method(), body: route.request().postData() });
            body = {
                ...task, id: 2, title: `${task.title} (Copia)`, status: "pending",
                checklist_items: task.checklist_items.map(item => ({ ...item, id: item.id + 10, completed: false })),
            };
        }
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
    if (fromList && pricing.completed) {
        await page.getByRole("combobox", { name: "Filtrar por estado", exact: true }).click();
        await page.getByRole("option", { name: "Completada", exact: true }).click();
    }
    await page.getByRole("button", { name: fromList ? task.title : `Abrir tarea: ${task.title}`, exact: true }).click();
    const dialog = page.getByRole("dialog", { name: /QA integridad edición/ });
    await expect(dialog).toBeVisible();
    return { dialog, updates, creations, source: () => structuredClone(task) };
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

for (const width of [1440, 768, 390]) {
    for (const theme of ["light", "dark"]) {
        test(`modal headers and footers share the sheet background in ${theme} at ${width}px`, async ({ context, page }) => {
            await page.addInitScript(value => localStorage.setItem("theme", value), theme);
            const { dialog, updates } = await openEditor(context, page, width);
            await expect(page.locator("html")).toHaveClass(theme === "light" ? /light-mode/ : /^(?!.*light-mode)/);
            const chrome = dialog.locator('[data-slot="dialog-header"], .dialog-glass-chrome');
            expect(await chrome.count()).toBeGreaterThanOrEqual(2);
            for (const section of await chrome.all()) {
                await expect(section).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
                await expect(section).toHaveCSS("backdrop-filter", "none");
            }
            await dialog.locator("#task-edit-notes").fill("QA borrador para comprobar descarte");
            await dialog.getByRole("button", { name: "Close", exact: true }).click();
            const confirmation = page.getByRole("alertdialog");
            await expect(confirmation).toBeVisible();
            for (const slot of ["alert-dialog-header", "alert-dialog-footer"]) {
                await expect(confirmation.locator(`[data-slot="${slot}"]`)).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
            }
            await confirmation.getByRole("button", { name: "Salir sin guardar", exact: true }).click();
            await expect(dialog).toHaveCount(0);
            await page.getByRole("button", { name: "Nueva Tarea", exact: true }).click();
            const create = page.getByRole("dialog");
            await expect(create).toBeVisible();
            const createChrome = create.locator('[data-slot="dialog-header"], .dialog-glass-chrome');
            expect(await createChrome.count()).toBeGreaterThanOrEqual(2);
            for (const section of await createChrome.all()) {
                await expect(section).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
                await expect(section).toHaveCSS("backdrop-filter", "none");
            }
            await create.getByRole("button", { name: "Close", exact: true }).click();
            await expect(create).toHaveCount(0);
            expect(updates).toHaveLength(0);
        });
    }
}

for (const width of [1440, 768, 390]) {
    for (const theme of ["light", "dark"]) {
        test(`task controls and footer align consistently in ${theme} at ${width}px`, async ({ context, page }) => {
            await page.addInitScript(value => localStorage.setItem("theme", value), theme);
            const { dialog } = await openEditor(context, page, width);
            await dialog.getByRole("heading", { name: /QA integridad edición/ }).click();
            const location = dialog.getByLabel(/instalación.*ubicación/i);
            await expect(location).toHaveValue("QA ubicación");
            await expect(location).toHaveAttribute("readonly", "");
            await expect(dialog.locator("#task-edit-time")).toHaveCSS("color-scheme", theme);
            const surfaces = [dialog.locator("#task-edit-title"), location, dialog.locator('[data-slot="input-group"]').first(), dialog.locator("#task-edit-time")];
            await expect(async () => {
                const styles = await Promise.all(surfaces.map(control => control.evaluate(element => {
                    const css = getComputedStyle(element);
                    return { height: css.height, radius: css.borderRadius, border: css.borderColor, background: css.backgroundColor, shadow: css.boxShadow };
                })));
                expect(styles[0].height).toBe("44px");
                for (const style of styles) expect(style).toEqual(styles[0]);
            }).toPass({ timeout: 3000 });
            const remove = await dialog.getByRole("button", { name: "Eliminar", exact: true }).boundingBox();
            const duplicate = await dialog.getByRole("button", { name: "Duplicar", exact: true }).boundingBox();
            const save = await dialog.getByRole("button", { name: "Guardar Cambios", exact: true }).boundingBox();
            expect(remove).not.toBeNull(); expect(duplicate).not.toBeNull(); expect(save).not.toBeNull();
            expect(remove!.y).toBe(duplicate!.y);
            expect(remove!.height).toBe(duplicate!.height);
            if (width < 640) {
                expect(save!.y).toBeGreaterThanOrEqual(remove!.y + remove!.height);
                expect(save!.x).toBe(remove!.x);
                expect(save!.x + save!.width).toBe(duplicate!.x + duplicate!.width);
                expect(remove!.width).toBe(duplicate!.width);
            } else expect(save!.y).toBe(remove!.y);
            await dialog.getByRole("button", { name: "Close", exact: true }).click();
            await expect(page.getByRole("alertdialog")).toHaveCount(0);
        });
    }
}

for (const width of [1440, 768, 390]) {
    for (const fromList of [false, true]) {
        test(`keyboard planning time persists from ${fromList ? "list" : "board"} at ${width}px`, async ({ context, page }) => {
            const state = await openEditor(context, page, width, null, null, fromList);
            await state.dialog.locator("#task-edit-date").fill("10/06/2050");
            await state.dialog.locator("#task-edit-title").click();
            const time = state.dialog.locator("#task-edit-time");
            await time.fill("10:35");
            await time.press("ArrowUp");
            const value = await time.inputValue();
            expect(value).toMatch(/^\d{2}:\d{2}$/);
            expect(value).not.toBe("10:35");
            const [hours, minutes] = value.split(":").map(Number);
            const expected = new Date(2050, 5, 10, hours, minutes).toISOString();
            await state.dialog.getByRole("button", { name: "Guardar Cambios", exact: true }).click();
            await expect(state.dialog).toHaveCount(0);
            expect(state.updates).toHaveLength(1);
            expect(state.updates[0].scheduled_start_at).toBe(expected);
            await page.getByRole("button", { name: fromList ? "QA integridad edición" : "Abrir tarea: QA integridad edición", exact: true }).click();
            await expect(time).toHaveValue(value);
            await state.dialog.locator("#task-edit-notes").fill("QA conservar hora de teclado");
            await state.dialog.getByRole("button", { name: "Guardar Cambios", exact: true }).click();
            await expect(state.dialog).toHaveCount(0);
            expect(state.updates).toHaveLength(2);
            expect(state.updates[1].scheduled_start_at).toBe(expected);
        });

        test(`completed structured work can save notes from ${fromList ? "list" : "board"} at ${width}px`, async ({ context, page }) => {
            const state = await openEditor(context, page, width, null, null, fromList, { completed: true, structuredOnly: true });
            const before = state.source();
            await state.dialog.locator("#task-edit-notes").fill("QA nota conservando requisitos");
            await state.dialog.getByRole("button", { name: "Guardar Cambios", exact: true }).click();
            await expect(state.dialog).toHaveCount(0);
            expect(state.updates).toHaveLength(1);
            expect(state.updates[0].notes).toBe("QA nota conservando requisitos");
            expect(state.source().checklist_items).toEqual(before.checklist_items);
        });

        test(`duplicating completed work uses its stored definition from ${fromList ? "list" : "board"} at ${width}px`, async ({ context, page }) => {
            const state = await openEditor(context, page, width, null, null, fromList, { completed: true });
            const before = state.source();
            await state.dialog.getByRole("button", { name: "Duplicar", exact: true }).click();
            await expect(state.dialog).toHaveCount(0);
            expect(state.creations).toHaveLength(1);
            expect(state.creations[0]).toEqual({ method: "POST", body: null });
            expect(state.source()).toEqual(before);
        });
    }
}
