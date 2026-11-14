import { expect, test, type BrowserContext, type Page } from "@playwright/test";

async function setup(context: BrowserContext, page: Page, width: number, locale = "es") {
    await page.setViewportSize({ width, height: 1000 });
    const token = Buffer.from(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600 })).toString("base64url");
    await context.addCookies([{ name: "auth_token", value: `fixture.${token}.not-a-backend-token`, url: "http://localhost:3000" }]);
    await page.addInitScript(value => localStorage.setItem("locale", value), locale);
    const state = { locationsStatus: 200, tasksStatus: 200, clientOneStatus: 200, emptyClientOne: false, clientOneReads: 0, clientOneGate: null as Promise<void> | null };
    await page.route("**/api/v1/**", async route => {
        const url = new URL(route.request().url());
        const path = url.pathname.replace(/\/$/, "");
        let body: unknown = [];
        let status = 200;
        if (path.endsWith("/users/me")) body = { id: 1, company_id: 1, full_name: "QA", role: { name: "admin" }, is_active: true };
        else if (path.endsWith("/companies/1")) body = { id: 1, name: "QA", onboarding_completed: true, subscription_status: "active" };
        else if (path.endsWith("/clients/access")) body = { can_read_clients: true };
        else if (path.endsWith("/clients")) body = [{ id: 1, name: "Cliente uno" }, { id: 2, name: "Cliente dos" }];
        else if (path.endsWith("/locations")) {
            const client = url.searchParams.get("client_id");
            if (client === "1") { state.clientOneReads++; await state.clientOneGate; }
            status = client === "1" ? state.clientOneStatus : state.locationsStatus;
            body = [1, 2].filter(id => (!client || id === Number(client)) && !(client === "1" && state.emptyClientOne))
                .map(id => ({ id, name: `Ubicación QA ${id}`, client_id: id, owner_company_id: 1, managing_company_id: 1, can_manage_location: true, is_active: true }));
        } else if (path.endsWith("/task-items")) {
            status = state.tasksStatus;
            body = [{ id: 1, location_id: 1, status: "pending" }, { id: 2, location_id: 1, status: "completed" }];
        }
        await route.fulfill({ status, json: status === 200 ? body : { detail: "Unavailable" } });
    });
    return state;
}

const empty = "No hay ubicaciones para mostrar con los filtros actuales.";
const selectClient = async (page: Page, name: string) => {
    await page.getByRole("combobox", { name: "Todos los clientes", exact: true }).click();
    await page.getByRole("option", { name, exact: true }).click();
};

for (const width of [390, 768, 1440]) {
    test(`locations retry without false empty or false task zeros at ${width}px`, async ({ context, page }) => {
        test.skip(process.env.E2E_BASE_URL !== "http://localhost:3000", "Local UI regression only");
        const state = await setup(context, page, width);
        state.locationsStatus = 503;
        await page.goto("/dashboard/locations");
        await expect(page.locator("main").getByRole("alert")).toContainText("No se pudieron cargar las ubicaciones.");
        await expect(page.getByText(empty, { exact: true })).toHaveCount(0);
        state.locationsStatus = 200;
        state.tasksStatus = 503;
        await page.getByRole("button", { name: "Reintentar", exact: true }).click();
        const row = page.getByRole("row", { name: "Ver detalle de Ubicación QA 1", exact: true });
        await expect(row).toBeVisible();
        await expect(page.locator("main").getByRole("alert")).toContainText("No se pudo cargar el recuento de tareas.");
        await expect(row).not.toContainText("0 tareas");
        await expect(row).toContainText("—");
        state.tasksStatus = 200;
        await page.getByRole("button", { name: "Reintentar", exact: true }).click();
        await expect(page.locator("main").getByRole("alert")).toHaveCount(0);
        await expect(row).toContainText("2");
        await expect(row).not.toContainText("—");
        state.locationsStatus = 503;
        await page.evaluate(() => window.dispatchEvent(new Event("focus")));
        await expect(page.locator("main").getByRole("alert")).toContainText("No se pudieron cargar las ubicaciones.");
        await expect(row).toBeVisible();
        state.locationsStatus = 403;
        await page.getByRole("button", { name: "Reintentar", exact: true }).click();
        await expect(page.locator("main").getByRole("alert")).toContainText("No tienes acceso a estas ubicaciones.");
        await expect(row).toHaveCount(0);
        await expect(page.getByText(empty, { exact: true })).toHaveCount(0);
    });

    test(`locations clear denied data and only show confirmed empty at ${width}px`, async ({ context, page }) => {
        test.skip(process.env.E2E_BASE_URL !== "http://localhost:3000", "Local UI regression only");
        const state = await setup(context, page, width);
        await page.goto("/dashboard/locations");
        await expect(page.getByRole("row", { name: "Ver detalle de Ubicación QA 1", exact: true })).toBeVisible();
        state.clientOneStatus = 403;
        await selectClient(page, "Cliente uno");
        await expect(page.locator("main").getByRole("alert")).toContainText("No tienes acceso a estas ubicaciones.");
        await expect(page.getByRole("row", { name: /Ver detalle de Ubicación QA/ })).toHaveCount(0);
        await expect(page.getByText(empty, { exact: true })).toHaveCount(0);
        state.clientOneStatus = 200;
        state.emptyClientOne = true;
        await page.getByRole("button", { name: "Reintentar", exact: true }).click();
        await expect(page.getByText(empty, { exact: true })).toBeVisible();
    });

    test(`late location filter responses cannot replace the selected client at ${width}px`, async ({ context, page }) => {
        test.skip(process.env.E2E_BASE_URL !== "http://localhost:3000", "Local UI regression only");
        const state = await setup(context, page, width);
        await page.goto("/dashboard/locations");
        await expect(page.getByRole("row", { name: "Ver detalle de Ubicación QA 1", exact: true })).toBeVisible();
        let release!: () => void;
        state.clientOneGate = new Promise<void>(resolve => { release = resolve; });
        await selectClient(page, "Cliente uno");
        await expect.poll(() => state.clientOneReads).toBe(1);
        await selectClient(page, "Cliente dos");
        await expect(page.getByRole("row", { name: "Ver detalle de Ubicación QA 2", exact: true })).toBeVisible();
        const lateResponse = page.waitForResponse(response => new URL(response.url()).searchParams.get("client_id") === "1");
        release();
        await lateResponse;
        await page.waitForLoadState("networkidle");
        await expect(page.getByRole("row", { name: "Ver detalle de Ubicación QA 1", exact: true })).toHaveCount(0);
        await expect(page.getByRole("row", { name: "Ver detalle de Ubicación QA 2", exact: true })).toBeVisible();
    });
}

test("location read errors and retry are localized in English", async ({ context, page }) => {
    test.skip(process.env.E2E_BASE_URL !== "http://localhost:3000", "Local UI regression only");
    const state = await setup(context, page, 390, "en");
    state.locationsStatus = 503;
    await page.goto("/dashboard/locations");
    await expect(page.locator("main").getByRole("alert")).toContainText("The locations could not be loaded.");
    state.locationsStatus = 200;
    await page.getByRole("button", { name: "Retry", exact: true }).click();
    await expect(page.getByRole("row", { name: "View Ubicación QA 1", exact: true })).toBeVisible();
});

for (const width of [390, 768, 1440]) {
    for (const locale of ["es", "en"]) {
        test(`forbidden task counts explain permissions and clear stale totals at ${width}px in ${locale}`, async ({ context, page }) => {
            test.skip(process.env.E2E_BASE_URL !== "http://localhost:3000", "Local UI regression only");
            const state = await setup(context, page, width, locale);
            state.tasksStatus = 403;
            await page.goto("/dashboard/locations");
            const alert = page.locator("main").getByRole("alert");
            const message = locale === "es" ? "No tienes permiso para consultar el recuento de tareas. Las ubicaciones siguen disponibles." : "You do not have permission to view task counts. Locations remain available.";
            const row = page.getByRole("row", { name: /Ubicación QA 1/ });
            await expect(alert).toHaveText(message);
            await expect(alert.getByRole("button")).toHaveCount(0);
            await expect(row).toContainText("—");
            state.tasksStatus = 200;
            await page.evaluate(() => window.dispatchEvent(new Event("focus")));
            await expect(alert).toHaveCount(0);
            await expect(row).toContainText("2");
            await expect(row).not.toContainText("—");
            state.tasksStatus = 403;
            await page.evaluate(() => window.dispatchEvent(new Event("focus")));
            await expect(alert).toHaveText(message);
            await expect(alert.getByRole("button")).toHaveCount(0);
            await expect(row).toContainText("—");
        });
    }
}
