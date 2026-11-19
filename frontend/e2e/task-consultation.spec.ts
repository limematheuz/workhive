import { expect, test, type BrowserContext, type Page } from "@playwright/test";

async function fixture(context: BrowserContext, page: Page, overview = false) {
    const base = test.info().project.use.baseURL;
    if (!base || !/^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(base)) throw new Error("This intercepted workflow requires a local preview.");
    const actor = { id: 701, email: "operations@example.test", full_name: "Responsable QA", role: { id: 1, name: "admin" }, company_id: 91, is_active: true, can_manage_work: true };
    const day = new Date(); day.setHours(14, 0, 0, 0);
    const tasks = Array.from({ length: overview ? 1 : 5 }, (_, index) => ({ id: index + 1, title: `Servicio ${index + 1}`, description: "Instrucciones del trabajo", notes: "Nota original", location_id: 11, user_id: overview ? null : 701, status: "pending", priority: "medium", unit: "servicio", is_invoiced: false, scheduled_start_at: new Date(day.getTime() + index * 3600000).toISOString(), due_at: new Date(day.getTime() + (index + 1) * 3600000).toISOString(), created_at: day.toISOString(), updated_at: day.toISOString(), assignments: overview ? [] : [{ user_id: 701, user_name: actor.full_name, status: "accepted" }], checklist_items: [] }));
    const state = { failSave: false, conflict: false, rosterFailure: false, rosterReads: 0, patches: [] as unknown[], errors:[] as string[] };
    page.on("pageerror",error=>state.errors.push(error.message));
    const payload = Buffer.from(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600 })).toString("base64url");
    await context.addCookies([{ name: "auth_token", value: `fixture.${payload}.signature`, url: base }]);
    await page.addInitScript(() => { localStorage.setItem("locale", "es"); sessionStorage.removeItem("workhive_user_cache:v1"); });
    await page.route("**/api/v1/**", async route => {
        const request = route.request(), path = new URL(request.url()).pathname.replace(/\/$/, "");
        if (path === "/api/v1/traffic/page-view") { await route.fulfill({ status: 204 }); return; }
        if (path === "/api/v1/auth/csrf") { await route.fulfill({ json: { csrf_token: "fixture-csrf" } }); return; }
        if(path==="/api/v1/companies/current/entitlements"){await route.fulfill({json:{entitlements:["features.work_orders","features.planning","features.time_tracking"].map(code=>({code,label:code,group:"Funciones",value_type:"boolean",value:true,source:"plan",availability:"available"}))}});return;}
        if(path==="/api/v1/organization/access"){await route.fulfill({json:{"work.read":true,"work.manage":true,"time.read":true,"time.manage":true,"access.members.read":true}});return;}
        if (path === "/api/v1/users/me") { await route.fulfill({ json: actor }); return; }
        if (path === "/api/v1/users") { await route.fulfill({ json: [actor] }); return; }
        if (path === "/api/v1/session/companies") { await route.fulfill({ json: { current_company_id: 91, companies: [{ id: 91, name: "Empresa QA", access_class: "admin", disabled: false }] } }); return; }
        if (overview && path === "/api/v1/staff-shifts/roster") {
            state.rosterReads++;
            if (state.rosterFailure) { await route.fulfill({ status: 503, json: { detail: "Plantilla temporalmente no disponible" } }); return; }
            await route.fulfill({ json: { items: [{ id: 1, employee_id: 410, effective_employee_id: 410, employee_name: "Elena sin cuenta", planned_employee_name: "Elena sin cuenta", account_user_id: null, task_id: 1, location_id: 11, starts_at: tasks[0].scheduled_start_at, ends_at: tasks[0].due_at, coverage: "Asignado" }], has_more: false } }); return;
        }
        if (overview && path === "/api/v1/work-sessions/company/active") { await route.fulfill({ json: [] }); return; }
        if (overview && path === "/api/v1/quality/access") { await route.fulfill({ json: { sections: { incidents: { can_read: false } } } }); return; }
        if(path==="/api/v1/template-tasks"||path==="/api/v1/notifications"||path==="/api/v1/client-portal/workspaces"){await route.fulfill({json:[]});return;}
        if(path==="/api/v1/locations/catalog"){await route.fulfill({json:{site_types:[],space_library:[]}});return;}
        if (path === "/api/v1/locations") { await route.fulfill({ json: [{ id: 11, name: "Edificio Norte", address: "Calle de prueba 1", city: "Madrid", owner_company_id: 91, can_manage_tasks: true, can_manage_location: true, is_active: true }] }); return; }
        if (path === "/api/v1/task-items") { await route.fulfill({ json: tasks }); return; }
        const match = path.match(/^\/api\/v1\/task-items\/(\d+)$/);
        if (match) {
            const task = tasks.find(row => row.id === Number(match[1]))!;
            if (request.method() === "PATCH" || request.method() === "PUT") {
                state.patches.push(request.postDataJSON());
                if (state.failSave) { await route.fulfill({ status: 503, json: { detail: "Guardado temporalmente no disponible" } }); return; }
                Object.assign(task, request.postDataJSON(), { updated_at: new Date().toISOString() });
            }
            await route.fulfill({ json: state.conflict ? { ...task, notes: "Cambio de otra persona", updated_at: "2099-01-01T00:00:00Z" } : task }); return;
        }
        await route.fulfill({ status:404,json:{detail:"Endpoint no configurado en este caso de prueba"} });
    });
    return state;
}

test("desktop reviews five results in order and retains the search when closing", async ({ context, page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    const state=await fixture(context, page);
    await page.goto("/dashboard/tasks?tab=list");
    const search=page.getByRole("searchbox",{name:"Buscar trabajo o ubicación"});
    await search.fill("Registro inexistente para esta búsqueda");
    await expect(page.getByRole("row",{name:/^Abrir Servicio/})).toHaveCount(0);
    await page.getByRole("button",{name:/^Pendientes.*5/}).click();
    await expect(search).toHaveValue("");
    await expect(page.getByRole("row",{name:/^Abrir Servicio/})).toHaveCount(5);
    await expect(page).toHaveURL(/status=pending/);
    await page.getByRole("searchbox", { name: "Buscar trabajo o ubicación" }).fill("Servicio");
    await page.getByRole("row", { name: "Abrir Servicio 1", exact: true }).click();
    for (let index = 1; index <= 5; index++) {
        const card = page.getByRole("region", { name: `Resumen de Servicio ${index}`, exact: true });
        await expect(card).toBeVisible();
        await expect(card.getByText(`${index} de 5 resultados`, { exact: true })).toBeVisible();
        if (index < 5) await card.getByRole("button", { name: "Trabajo siguiente", exact: true }).click();
        else await expect(card.getByRole("button", { name: "Trabajo siguiente", exact: true })).toBeDisabled();
    }
    await page.getByRole("button", { name: "Cerrar resumen y volver a resultados" }).click();
    await expect(page.getByRole("searchbox", { name: "Buscar trabajo o ubicación" })).toHaveValue("Servicio");
    await expect(page.getByRole("region", { name: /^Resumen de Servicio/ })).toHaveCount(0);
    await expect(page.getByRole("row", { name: "Abrir Servicio 1", exact: true })).toBeFocused();
    expect(state.errors).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test("mobile preserves a failed draft and guards navigation until saving succeeds", async ({ context, page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const state = await fixture(context, page); state.failSave = true;
    await page.goto("/dashboard/tasks?tab=list");
    await page.getByRole("button", { name: "Más filtros", exact: true }).click();
    const filters = page.getByRole("dialog", { name: "Filtrar trabajos", exact: true });
    await filters.getByRole("combobox", { name: "Filtrar por ubicación", exact: true }).click();
    await page.getByRole("option", { name: "Edificio Norte", exact: true }).click();
    await filters.getByRole("button", { name: "Ver 5 tareas", exact: true }).click();
    await expect(page).toHaveURL(/location=11/);
    await expect(page.getByRole("button", { name: "Quitar filtro Ubicación: Edificio Norte", exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Abrir Servicio 1", exact: true }).click();
    const detail = page.getByRole("dialog", { name: "Detalle de trabajo", exact: true });
    await expect(detail).toBeVisible();
    await detail.getByRole("button", { name: "Editar tarea", exact: true }).click();
    await detail.getByRole("textbox", { name: "Notas operativas", exact: true }).fill("Borrador que debe conservarse");
    await detail.getByRole("button", { name: "Trabajo siguiente", exact: true }).click();
    const guard = page.getByRole("dialog", { name: "Tienes cambios sin guardar", exact: true });
    await guard.getByRole("button", { name: "Guardar y continuar", exact: true }).click();
    await expect(guard.getByRole("alert")).toContainText("Guardado temporalmente no disponible");
    await guard.getByRole("button", { name: "Seguir editando", exact: true }).click();
    await expect(detail.getByRole("textbox", { name: "Notas operativas", exact: true })).toHaveValue("Borrador que debe conservarse");
    state.failSave = false;
    await detail.getByRole("button", { name: "Guardar cambios", exact: true }).click();
    await expect(detail.getByText("Borrador que debe conservarse", { exact: true })).toBeVisible();
    await detail.getByRole("button", { name: "Cerrar resumen y volver a resultados", exact: true }).click();
    await expect(detail).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Abrir Servicio 1", exact: true })).toBeFocused();
    expect(state.patches).toEqual([{ title: "Servicio 1", notes: "Borrador que debe conservarse" }, { title: "Servicio 1", notes: "Borrador que debe conservarse" }]);
    expect(state.errors).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test("overview does not invent zero assigned workers after a roster failure and recovers staff without accounts", async ({ context, page }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    const state = await fixture(context, page, true); state.rosterFailure = true;
    await page.goto("/dashboard");
    const metrics = page.getByRole("region", { name: "Resumen", exact: true });
    const assigned = metrics.getByRole("button", { name: /^Trabajadores asignados/ });
    const unassigned = metrics.getByRole("button", { name: /^Sin asignar/ });
    await expect(assigned).toBeDisabled();
    await expect(assigned.getByText("—", { exact: true })).toBeVisible();
    await expect(assigned).toContainText("No se pudo comprobar");
    await expect(unassigned).toBeDisabled();
    await expect(unassigned.getByText("—", { exact: true })).toBeVisible();
    await expect(assigned.getByText("0", { exact: true })).toHaveCount(0);
    const locations = page.getByRole("region", { name: /^Ubicaciones con trabajo/ });
    await expect(locations.getByRole("status")).toContainText("Asignación no disponible");
    await expect(locations.getByText("Sin asignar", { exact: true })).toHaveCount(0);
    const forecast = page.getByRole("region", { name: "Próximos 7 días", exact: true });
    await expect(forecast.getByRole("button", { name: /1 servicio$/ })).toBeVisible();
    await expect(forecast).not.toContainText("sin asignar");
    await expect(forecast).not.toContainText("personas");
    state.rosterFailure = false;
    await page.locator(".wh-overview-resource-warning").getByRole("button", { name: "Actualizar", exact: true }).click();
    await expect(assigned).toBeEnabled();
    await expect(assigned.getByText("1", { exact: true })).toBeVisible();
    await expect(unassigned).toBeEnabled();
    await expect(unassigned.getByText("0", { exact: true })).toBeVisible();
    await expect(locations.getByText("Elena sin cuenta", { exact: true })).toBeVisible();
    expect(state.rosterReads).toBeGreaterThanOrEqual(2);
    await forecast.getByRole("button", { name: /1 servicio$/ }).click();
    const services = page.getByRole("dialog", { name: /^Servicios programados/ });
    await expect(services.getByRole("row", { name: "Abrir tarea: Servicio 1", exact: true })).toBeVisible();
    expect(state.errors).toEqual([]);
});
