import { expect, test, type Page } from "@playwright/test";

function coverageContract() {
    return {
        id: 1, contract_number: "CON-COVERAGE", title: "Contrato QA", status: "active", company_id: 1, client_id: 1,
        source_quote_id: 1, source_quote_revision_id: 1, starts_at: null, ends_at: null,
        renewal_mode: "manual", renewal_notice_days: 30, response_time_hours: 24, resolution_time_hours: 48,
        service_window: "Horario QA", notes: "Notas originales", quote_snapshot: { total_amount: 100 }, service_lines: [], created_at: "2026-01-01",
        covered_locations: [{ id: 1, location_id: 1, location_name: "Sede original", is_active: true, covered_from: "2026-01-01", covered_zones: [] }],
    };
}

// Every API request is intercepted; this suite never changes local contracts.
test.beforeEach(async ({ context, page }) => {
    test.skip(process.env.E2E_BASE_URL !== "http://localhost:3000", "Local UI regression only");
    const payload = Buffer.from(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600 })).toString("base64url");
    await context.addCookies([{ name: "auth_token", value: `fixture.${payload}.not-a-backend-token`, url: "http://localhost:3000" }]);
    await page.addInitScript(() => localStorage.setItem("locale", "es"));
    const contract = coverageContract();
    await page.route("**/api/v1/**", async route => {
        const path = new URL(route.request().url()).pathname.replace(/\/$/, "");
        let body: unknown = [];
        if (path === "/api/v1/users/me") body = { id: 1, full_name: "QA", role: { name: "admin" }, company_id: 1, is_active: true };
        else if (path === "/api/v1/companies/1") body = { id: 1, name: "QA", onboarding_completed: true, subscription_status: "active" };
        else if (path.includes("entitlements")) body = { entitlements: [{ code: "features.quotes", value_type: "boolean", value: true }] };
        else if (path === "/api/v1/service-contracts") body = [contract];
        else if (path === "/api/v1/service-contracts/1") body = contract;
        else if (path.endsWith("/location-candidates")) body = [{ id: 2, name: "Sede añadida QA", is_active: true, client_id: 1 }];
        else if (path === "/api/v1/service-contracts/1/locations") {
            expect(route.request().postDataJSON()).toEqual({ location_ids: [2] });
            contract.covered_locations.push({ id: 2, location_id: 2, location_name: "Sede añadida QA", is_active: true, covered_from: "2026-01-01", covered_zones: [] });
            body = contract;
        }
        else if (path.endsWith("/zone-candidates")) body = [{ id: 1, name: "Zona QA" }];
        else if (path === "/api/v1/margin-forecasts/contracts/1") body = {
            scope_type: "contract", scope_id: 1, scope_name: contract.title,
            budget: { id: 1, planned_direct_cost_amount: 15, notes: "Base original" },
            planned_revenue_base_amount: 100, planned_direct_cost_base_amount: 15, planned_margin_base_amount: 85,
            actual_revenue_base_amount: 0, actual_labor_cost_base_amount: 0, actual_material_cost_base_amount: 0,
            actual_expense_cost_base_amount: 0, actual_direct_cost_base_amount: 0, actual_margin_base_amount: 0, direct_cost_variance_base_amount: -15,
        };
        else if (path.includes("alert-count")) body = { pending_requests: 0, pending_tasks: 0, unread_reports: 0 };
        await route.fulfill({ json: body });
    });
});

async function selectLocation(page: Page) {
    await page.goto("/dashboard/contracts");
    await page.locator('[aria-label="Abrir contrato CON-COVERAGE"]').filter({ visible: true }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByLabel("Base de cálculo interna")).toHaveValue("Base original");
    await dialog.getByRole("combobox", { name: "Añadir ubicación cubierta", exact: true }).click();
    await page.getByRole("option", { name: "Sede añadida QA", exact: true }).click();
    return dialog;
}

for (const width of [1440, 768, 390]) {
    test(`saved coverage closes cleanly after its picker disappears at ${width}px`, async ({ page }) => {
        await page.setViewportSize({ width, height: 1000 });
        const dialog = await selectLocation(page);
        await dialog.getByRole("button", { name: "Añadir ubicación", exact: true }).click();
        await expect(page.getByText("Ubicación añadida al contrato", { exact: true })).toBeVisible();
        await expect(dialog.getByRole("combobox", { name: "Añadir ubicación cubierta", exact: true })).toHaveCount(0);
        await dialog.getByRole("button", { name: "Cerrar", exact: true }).click();
        await expect(page.getByRole("alertdialog")).toHaveCount(0);
        await expect(dialog).toHaveCount(0);
        await page.locator('[aria-label="Abrir contrato CON-COVERAGE"]').filter({ visible: true }).click();
        await expect(dialog.getByText("Sede añadida QA", { exact: true })).toBeVisible();
    });
}

for (const section of ["conditions", "margin", "zones"]) {
    test(`adding coverage preserves unsaved ${section}`, async ({ page }) => {
        const dialog = await selectLocation(page);
        if (section === "conditions") await dialog.getByLabel("Notas internas", { exact: true }).fill("Condiciones pendientes QA");
        else if (section === "margin") await dialog.getByLabel("Base de cálculo interna", { exact: true }).fill("Coste pendiente QA");
        else {
            await dialog.getByRole("button", { name: "Zonas", exact: true }).click();
            await dialog.getByRole("checkbox", { name: "Zona QA", exact: true }).check();
        }
        await dialog.getByRole("button", { name: "Añadir ubicación", exact: true }).click();
        await expect(page.getByText("Ubicación añadida al contrato", { exact: true })).toBeVisible();
        await dialog.getByRole("button", { name: "Cerrar", exact: true }).click();
        await expect(page.getByRole("alertdialog")).toBeVisible();
        await page.getByRole("button", { name: "Seguir editando", exact: true }).click();
        if (section === "conditions") await expect(dialog.getByLabel("Notas internas", { exact: true })).toHaveValue("Condiciones pendientes QA");
        else if (section === "margin") await expect(dialog.getByLabel("Base de cálculo interna", { exact: true })).toHaveValue("Coste pendiente QA");
        else await expect(dialog.getByRole("checkbox", { name: "Zona QA", exact: true })).toBeChecked();
    });
}

test("unsaved selection and failed coverage save remain guarded until a successful retry", async ({ page }) => {
    await page.route("**/api/v1/service-contracts/1/locations", route => route.fulfill({ status: 503, json: { detail: "QA unavailable" } }), { times: 1 });
    const dialog = await selectLocation(page);
    await dialog.getByRole("button", { name: "Cerrar", exact: true }).click();
    await expect(page.getByRole("alertdialog")).toBeVisible();
    await page.getByRole("button", { name: "Seguir editando", exact: true }).click();
    await dialog.getByRole("button", { name: "Añadir ubicación", exact: true }).click();
    await expect(page.getByText("No se pudieron añadir las ubicaciones", { exact: true })).toBeVisible();
    await expect(dialog.getByRole("combobox", { name: "Añadir ubicación cubierta", exact: true })).toHaveText("Sede añadida QA");
    await dialog.getByRole("button", { name: "Cerrar", exact: true }).click();
    await expect(page.getByRole("alertdialog")).toBeVisible();
    await page.getByRole("button", { name: "Seguir editando", exact: true }).click();
    await dialog.getByRole("button", { name: "Añadir ubicación", exact: true }).click();
    await expect(page.getByText("Ubicación añadida al contrato", { exact: true })).toBeVisible();
    await dialog.getByRole("button", { name: "Cerrar", exact: true }).click();
    await expect(page.getByRole("alertdialog")).toHaveCount(0);
    await expect(dialog).toHaveCount(0);
});


test("saved coverage clears its selection when other candidates remain", async ({ page }) => {
    await page.route("**/api/v1/service-contracts/1/location-candidates", route => route.fulfill({ json: [
        { id: 2, name: "Sede añadida QA", is_active: true, client_id: 1 },
        { id: 3, name: "Otra sede QA", is_active: true, client_id: 1 },
    ] }));
    const dialog = await selectLocation(page);
    await dialog.getByRole("button", { name: "Añadir ubicación", exact: true }).click();
    await expect(page.getByText("Ubicación añadida al contrato", { exact: true })).toBeVisible();
    await expect(dialog.getByRole("combobox", { name: "Añadir ubicación cubierta", exact: true })).toHaveText("Selecciona ubicación");
    await expect(dialog.getByRole("button", { name: "Añadir ubicación", exact: true })).toBeDisabled();
    await dialog.getByRole("button", { name: "Cerrar", exact: true }).click();
    await expect(page.getByRole("alertdialog")).toHaveCount(0);
    await expect(dialog).toHaveCount(0);
});

for (const width of [1440, 768, 390, 320]) {
    test(`long references keep contract content and actions inside the dialog at ${width}px`, async ({ page }) => {
        const contract = { ...coverageContract(), contract_number: "QA-PORTAL-20261015-CONTRACT-LONG-REFERENCE",
            title: "Servicio para una ubicación con una referencia extensa",
            service_lines: [{ id: 1, description: "Servicio mensual de mantenimiento con descripción extensa", quantity: 1, unit_price: 100, subtotal: 100 }],
        };
        await page.route(/\/api\/v1\/service-contracts\/?(?:\?.*)?$/, route => route.fulfill({ json: [contract] }));
        await page.route("**/api/v1/service-contracts/1", route => route.fulfill({ json: contract }));
        await page.setViewportSize({ width, height: 844 });
        await page.goto("/dashboard/contracts");
        await page.locator(`[aria-label="Abrir contrato ${contract.contract_number}"]`).filter({ visible: true }).click();
        const dialog = page.getByRole("dialog");
        await expect(dialog.getByLabel("Base de cálculo interna")).toHaveValue("Base original");
        const dimensions = await dialog.evaluate(element => {
            const bounds = element.getBoundingClientRect();
            return { left: bounds.left, right: bounds.right, width: bounds.width, scrollWidth: element.scrollWidth };
        });
        expect(dimensions.left).toBeGreaterThanOrEqual(0);
        expect(dimensions.right).toBeLessThanOrEqual(width);
        expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.width + 1);
        for (const locator of [dialog.getByRole("heading", { name: contract.contract_number, exact: true }), dialog.getByRole("button", { name: "Zonas", exact: true }), dialog.getByText("Cubierta", { exact: true }), dialog.getByText("100,00 €", { exact: true })]) {
            const rects = await locator.evaluateAll(elements => elements.map(element => {
                const bounds = element.getBoundingClientRect();
                return { left: bounds.left, right: bounds.right };
            }));
            expect(rects.length).toBeGreaterThan(0);
            for (const bounds of rects) {
                expect(bounds.left).toBeGreaterThanOrEqual(dimensions.left);
                expect(bounds.right).toBeLessThanOrEqual(dimensions.right);
            }
        }
        await dialog.getByRole("button", { name: "Zonas", exact: true }).click();
        await expect(dialog.getByRole("checkbox", { name: "Zona QA", exact: true })).toBeVisible();
        await dialog.getByRole("button", { name: "Cancelar", exact: true }).click();
        await dialog.getByRole("button", { name: "Cerrar", exact: true }).click();
        await expect(dialog).toHaveCount(0);
    });
}

for (const width of [1440, 768, 390]) {
    for (const status of [403, 404, 503]) {
        test(`failed contract detail ${status} never opens cached data and allows retry at ${width}px`, async ({ page }) => {
            await page.setViewportSize({ width, height: 1000 });
            await page.goto("/dashboard/contracts");
            const row = page.locator('[aria-label="Abrir contrato CON-COVERAGE"]').filter({ visible: true });
            await expect(row).toBeVisible();
            await page.route("**/api/v1/service-contracts/1", route => route.fulfill({ status, json: { detail: "No se pudo cargar el contrato" } }), { times: 1 });
            const failed = page.waitForResponse(response => response.url().endsWith("/service-contracts/1") && response.status() === status);
            await row.click();
            await failed;
            await expect(page.getByText("No se pudo cargar el contrato", { exact: true })).toBeVisible();
            await expect(page.getByRole("dialog")).toHaveCount(0);
            await expect(page.getByLabel("Notas internas", { exact: true })).toHaveCount(0);
            await expect(row).toBeVisible();
            await row.click();
            await expect(page.getByRole("dialog").getByLabel("Notas internas", { exact: true })).toHaveValue("Notas originales");
        });
    }
}
