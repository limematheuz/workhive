import { expect, test, type Page } from "@playwright/test";

// Browser fixtures intercept every API request; no real contract is modified.
test.beforeEach(async ({ context, page }) => {
    test.skip(process.env.E2E_BASE_URL !== "http://localhost:3000", "Local UI regression only");
    const payload = Buffer.from(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600 })).toString("base64url");
    await context.addCookies([{ name: "auth_token", value: `fixture.${payload}.not-a-backend-token`, url: "http://localhost:3000" }]);
    await page.addInitScript(() => { localStorage.setItem("locale", "es"); });
    const contract = {
        id: 1, contract_number: "CON-TEST", title: "Contrato de prueba", status: "active", company_id: 1, client_id: 1,
        source_quote_id: 1, source_quote_revision_id: 1, starts_at: "2026-10-15T10:12:25.781694Z", ends_at: "2027-10-15T10:12:25.781694Z",
        renewal_mode: "manual", renewal_notice_days: 30, response_time_hours: 24, resolution_time_hours: 48,
        service_window: "Horario de prueba", notes: "Condiciones originales", quote_snapshot: { total_amount: 100 },
        service_lines: [], covered_locations: [{ id: 1, location_id: 1, location_name: "Ubicación de prueba", is_active: true, covered_from: "2026-01-01", covered_zones: [] }], created_at: "2026-01-01",
    };
    let budget = { id: 1, planned_direct_cost_amount: 15, notes: "Base original" };
    await page.route("**/api/v1/**", async route => {
        const path = new URL(route.request().url()).pathname.replace(/\/$/, "");
        let body: unknown = [];
        if (path === "/api/v1/users/me") body = { id: 1, full_name: "Usuario de prueba", role: { name: "admin" }, company_id: 1, is_active: true };
        else if (path === "/api/v1/companies/1") body = { id: 1, name: "Prueba", onboarding_completed: true, subscription_status: "active" };
        else if (path.includes("entitlements")) body = { entitlements: [{ code: "features.quotes", value_type: "boolean", value: true }] };
        else if (path === "/api/v1/service-contracts") body = [contract];
        else if (path === "/api/v1/service-contracts/1") {
            if (route.request().method() === "PATCH") Object.assign(contract, route.request().postDataJSON());
            body = contract;
        }
        else if (path.endsWith("/zone-candidates")) body = [{ id: 1, name: "Zona de prueba" }];
        else if (path === "/api/v1/margin-forecasts/contracts/1") {
            if (route.request().method() === "PUT") budget = { id: 1, ...route.request().postDataJSON() };
            body = {
                scope_type: "contract", scope_id: 1, scope_name: contract.title, budget,
                planned_revenue_base_amount: 100, planned_direct_cost_base_amount: budget.planned_direct_cost_amount,
                planned_margin_base_amount: 100 - budget.planned_direct_cost_amount,
                actual_revenue_base_amount: 0, actual_labor_cost_base_amount: 0, actual_material_cost_base_amount: 0,
                actual_expense_cost_base_amount: 0, actual_direct_cost_base_amount: 0, actual_margin_base_amount: 0,
                direct_cost_variance_base_amount: -budget.planned_direct_cost_amount,
            };
        }
        else if (path.includes("alert-count")) body = { pending_requests: 0, pending_tasks: 0, unread_reports: 0 };
        await route.fulfill({ json: body });
    });
});

async function openContract(page: Page) {
    await page.goto("/dashboard/contracts");
    await page.locator('[aria-label="Abrir contrato CON-TEST"]').filter({ visible: true }).click();
    await expect(page.getByLabel("Base de cálculo interna")).toHaveValue("Base original");
    return page.getByRole("dialog");
}

for (const width of [1440, 768, 390]) {
    test(`saved contract margin closes without discarding at ${width}px`, async ({ page }) => {
        await page.setViewportSize({ width, height: 900 });
        const dialog = await openContract(page);
        await dialog.getByLabel("Base de cálculo interna").fill("Base guardada");
        await dialog.getByRole("button", { name: "Guardar coste", exact: true }).click();
        await expect(page.getByText("Presupuesto de coste guardado.", { exact: true })).toBeVisible();
        await dialog.getByRole("button", { name: "Cerrar", exact: true }).click();
        await expect(page.getByRole("alertdialog")).toHaveCount(0);
        await expect(dialog).toHaveCount(0);
        await page.locator('[aria-label="Abrir contrato CON-TEST"]').filter({ visible: true }).click();
        await expect(page.getByLabel("Base de cálculo interna")).toHaveValue("Base guardada");
    });
}

for (const section of ["conditions", "zones", "renewal"]) {
    test(`saving margin preserves unsaved ${section}`, async ({ page }) => {
    const dialog = await openContract(page);
    if (section === "conditions") await dialog.getByLabel("Notas internas", { exact: true }).fill("Condiciones sin guardar");
    if (section === "zones") {
        await dialog.getByRole("button", { name: "Zonas", exact: true }).click();
        await dialog.getByRole("checkbox", { name: "Zona de prueba", exact: true }).check();
    }
    if (section === "renewal") {
        await dialog.getByRole("combobox").click();
        await page.getByRole("option", { name: "Automática", exact: true }).click();
    }
    await dialog.getByLabel("Base de cálculo interna").fill("Base guardada");
    await dialog.getByRole("button", { name: "Guardar coste", exact: true }).click();
    await expect(page.getByText("Presupuesto de coste guardado.", { exact: true })).toBeVisible();
    await dialog.getByRole("button", { name: "Cerrar", exact: true }).click();
    await expect(page.getByRole("alertdialog")).toBeVisible();
    await page.getByRole("button", { name: "Seguir editando", exact: true }).click();
    if (section === "conditions") await expect(dialog.getByLabel("Notas internas", { exact: true })).toHaveValue("Condiciones sin guardar");
    if (section === "zones") await expect(dialog.getByRole("checkbox", { name: "Zona de prueba", exact: true })).toBeChecked();
    if (section === "renewal") await expect(dialog.getByRole("combobox")).toHaveText("Automática");
    });
}

test("failed margin save and later edits still require confirmation", async ({ page }) => {
    const dialog = await openContract(page);
    const notes = dialog.getByLabel("Base de cálculo interna");
    await notes.fill("Base sin guardar");
    await page.route("**/api/v1/margin-forecasts/contracts/1", route => route.fulfill({ status: 503, json: { detail: "Fallo de prueba" } }), { times: 1 });
    await dialog.getByRole("button", { name: "Guardar coste", exact: true }).click();
    await expect(page.getByText("No se pudo cargar el margen previsto", { exact: true })).toBeVisible();
    await dialog.getByRole("button", { name: "Cerrar", exact: true }).click();
    await expect(page.getByRole("alertdialog")).toBeVisible();
    await page.getByRole("button", { name: "Seguir editando", exact: true }).click();
    await dialog.getByRole("button", { name: "Guardar coste", exact: true }).click();
    await expect(page.getByText("Presupuesto de coste guardado.", { exact: true })).toBeVisible();
    await notes.fill("Nueva edición posterior");
    await dialog.getByRole("button", { name: "Cerrar", exact: true }).click();
    await expect(page.getByRole("alertdialog")).toBeVisible();
});


test("saving a renewal notice preserves unchanged contract timestamps", async ({ page }) => {
    const updates: Record<string, unknown>[] = [];
    page.on("request", request => {
        if (request.method() === "PATCH" && new URL(request.url()).pathname === "/api/v1/service-contracts/1") {
            updates.push(request.postDataJSON());
        }
    });
    const dialog = await openContract(page);
    await dialog.getByLabel("Aviso previo (días)", { exact: true }).fill("45");
    await dialog.getByRole("button", { name: "Guardar condiciones", exact: true }).click();
    await expect(page.getByText("Condiciones del contrato guardadas", { exact: true })).toBeVisible();
    expect(updates).toHaveLength(1);
    expect(updates[0]).not.toHaveProperty("starts_at");
    expect(updates[0]).not.toHaveProperty("ends_at");
    expect(updates[0].renewal_notice_days).toBe(45);
    const reopened = await openContract(page);
    await expect(reopened.getByLabel("Aviso previo (días)", { exact: true })).toHaveValue("45");
    await expect(reopened.getByLabel("Inicio", { exact: true })).toHaveValue("15/10/2026");
    await expect(reopened.getByLabel("Fin", { exact: true })).toHaveValue("15/10/2027");
});

for (const width of [1440, 768, 390]) {
    test(`saved contract conditions close cleanly at ${width}px`, async ({ page }) => {
        await page.setViewportSize({ width, height: 1000 });
        const dialog = await openContract(page);
        await dialog.getByRole("combobox").filter({ hasText: "Manual" }).click();
        await page.getByRole("option", { name: "Automática", exact: true }).click();
        await dialog.getByLabel("Aviso previo (días)", { exact: true }).fill("45");
        await dialog.getByLabel("Notas internas", { exact: true }).fill("Condiciones guardadas QA");
        await dialog.getByRole("button", { name: "Guardar condiciones", exact: true }).click();
        await expect(page.getByText("Condiciones del contrato guardadas", { exact: true })).toBeVisible();
        await dialog.getByRole("button", { name: "Cerrar", exact: true }).click();
        await expect(page.getByRole("alertdialog")).toHaveCount(0);
        await expect(dialog).toHaveCount(0);
        const reopened = await openContract(page);
        await expect(reopened.getByLabel("Notas internas", { exact: true })).toHaveValue("Condiciones guardadas QA");
        await expect(reopened.getByLabel("Aviso previo (días)", { exact: true })).toHaveValue("45");
    });
}

for (const section of ["margin", "zones"]) {
    test(`saving conditions preserves unsaved ${section}`, async ({ page }) => {
        const dialog = await openContract(page);
        if (section === "margin") await dialog.getByLabel("Base de cálculo interna", { exact: true }).fill("Coste sin guardar QA");
        else {
            await dialog.getByRole("button", { name: "Zonas", exact: true }).click();
            await dialog.getByRole("checkbox", { name: "Zona de prueba", exact: true }).check();
        }
        await dialog.getByLabel("Notas internas", { exact: true }).fill("Condiciones guardadas QA");
        await dialog.getByRole("button", { name: "Guardar condiciones", exact: true }).click();
        await expect(page.getByText("Condiciones del contrato guardadas", { exact: true })).toBeVisible();
        await dialog.getByRole("button", { name: "Cerrar", exact: true }).click();
        await expect(page.getByRole("alertdialog")).toBeVisible();
        await page.getByRole("button", { name: "Seguir editando", exact: true }).click();
        if (section === "margin") await expect(dialog.getByLabel("Base de cálculo interna", { exact: true })).toHaveValue("Coste sin guardar QA");
        else await expect(dialog.getByRole("checkbox", { name: "Zona de prueba", exact: true })).toBeChecked();
    });
}

test("failed conditions save preserves the draft and successful retry clears it", async ({ page }) => {
    await page.route("**/api/v1/service-contracts/1", async route => {
        if (route.request().method() === "PATCH") {
            await route.fulfill({ status: 503, json: { detail: "QA temporary failure" } });
            return;
        }
        await route.fallback();
    });
    const dialog = await openContract(page);
    await dialog.getByLabel("Notas internas", { exact: true }).fill("Borrador conservado QA");
    await dialog.getByRole("button", { name: "Guardar condiciones", exact: true }).click();
    await expect(page.getByText("No se pudieron guardar las condiciones", { exact: true })).toBeVisible();
    await dialog.getByRole("button", { name: "Cerrar", exact: true }).click();
    await expect(page.getByRole("alertdialog")).toBeVisible();
    await page.getByRole("button", { name: "Seguir editando", exact: true }).click();
    await expect(dialog.getByLabel("Notas internas", { exact: true })).toHaveValue("Borrador conservado QA");
    await page.unroute("**/api/v1/service-contracts/1");
    await dialog.getByRole("button", { name: "Guardar condiciones", exact: true }).click();
    await expect(page.getByText("Condiciones del contrato guardadas", { exact: true })).toBeVisible();
    await dialog.getByRole("button", { name: "Cerrar", exact: true }).click();
    await expect(page.getByRole("alertdialog")).toHaveCount(0);
});
