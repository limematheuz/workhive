import { expect, test, type Page } from "@playwright/test";

async function openClient(page: Page, name: string) {
    const button = page.getByRole("button", { name: `Ver detalle de ${name}`, exact: true }).filter({ visible: true });
    if (await button.count()) await button.click();
    else await page.getByRole("row").filter({ hasText: name }).click();
    return page.getByRole("dialog", { name, exact: true });
}

async function openTasks(page: Page, dialog: ReturnType<Page["getByRole"]>) {
    const navigation = dialog.locator('[data-tab-navigation][data-tabs-ready="true"]').filter({ visible: true });
    await expect(navigation).toBeVisible();
    const tab = navigation.getByRole("tab", { name: /^Trabajos/i });
    if (await tab.count()) await tab.click();
    else { await navigation.getByRole("combobox").click(); await page.getByRole("option", { name: /^Trabajos/i }).click(); }
}

for (const width of [390, 768, 1440]) {
    test(`returning from a client task restores context but fresh clients reset it at ${width}px`, async ({ context, page }) => {
        test.skip(process.env.E2E_BASE_URL !== "http://localhost:3000", "Local UI regression only");
        await page.setViewportSize({ width, height: 1000 });
        const token = Buffer.from(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600 })).toString("base64url");
        await context.addCookies([{ name: "auth_token", value: `fixture.${token}.not-a-backend-token`, url: "http://localhost:3000" }]);
        await page.addInitScript(() => localStorage.setItem("locale", "es"));
        const writes: string[] = [];
        await page.route("**/api/v1/**", async route => {
            const path = new URL(route.request().url()).pathname.replace(/\/$/, "");
            if (route.request().method() !== "GET" && /^\/api\/v1\/(clients|locations|task-items)(\/|$)/.test(path)) writes.push(path);
            let body: unknown = [];
            if (path.endsWith("/users/me")) body = { id: 1, company_id: 1, role: { name: "admin" }, full_name: "QA", is_active: true };
            else if (path.endsWith("/companies/1")) body = { id: 1, name: "QA", onboarding_completed: true, subscription_status: "active" };
            else if (path.endsWith("/clients/access")) body = { can_read_clients: true, can_manage_clients: false };
            else if (path.endsWith("/clients")) body = [1, 2].map(id => ({ id, company_id: 1, name: `Cliente QA ${id}`, client_type: "individual", relationship_status: "client", is_active: true, address: "QA", city: "QA", postal_code: "00000", country: "España" }));
            else if (path.endsWith("/locations")) body = [1, 2].map(id => ({ id, name: `Lugar QA ${id}`, client_id: id, address: "QA", city: "QA", is_active: true }));
            else if (path.endsWith("/task-items")) body = [
                { id: 10, location_id: 1, title: "Trabajo buscado", status: "completed" },
                { id: 11, location_id: 1, title: "Otro trabajo", status: "pending" },
                { id: 12, location_id: 2, title: "Trabajo segundo cliente", status: "pending" },
            ].map(task => ({ ...task, company_id: 1, user_id: null, unit: "service", price: 0, quantity: 1, description: "Instrucciones QA" }));
            await route.fulfill({ json: body });
        });
        await page.goto("/dashboard/clients");
        await expect(page.getByText("Cliente QA 1", { exact: true }).filter({ visible: true })).toBeVisible();
        let dialog = await openClient(page, "Cliente QA 1");
        await openTasks(page, dialog);
        await dialog.getByRole("searchbox").fill("buscado");
        await dialog.getByRole("combobox", { name: "Todos los estados", exact: true }).click();
        await page.getByRole("option", { name: "Completadas", exact: true }).click();
        await dialog.getByRole("button", { name: "Abrir trabajo", exact: true }).filter({ visible: true }).click();
        await expect(page.getByRole("dialog", { name: "Detalle de la Tarea", exact: true })).toBeVisible();
        await page.getByRole("button", { name: "Volver al cliente", exact: true }).click();
        dialog = page.getByRole("dialog", { name: "Cliente QA 1", exact: true });
        await expect(dialog.getByRole("searchbox")).toHaveValue("buscado");
        await expect(dialog.getByRole("combobox", { name: "Todos los estados", exact: true })).toHaveText("Completadas");
        await expect(dialog.getByText("Otro trabajo", { exact: true }).filter({ visible: true })).toHaveCount(0);
        await dialog.getByRole("button", { name: "Close", exact: true }).click();
        dialog = await openClient(page, "Cliente QA 1");
        await expect(dialog.getByRole("searchbox")).toHaveCount(0);
        await openTasks(page, dialog);
        await expect(dialog.getByRole("searchbox")).toHaveValue("");
        await dialog.getByRole("button", { name: "Close", exact: true }).click();
        dialog = await openClient(page, "Cliente QA 2");
        await openTasks(page, dialog);
        await expect(dialog.getByRole("searchbox")).toHaveValue("");
        await expect(dialog.getByText("Trabajo segundo cliente", { exact: true }).filter({ visible: true })).toBeVisible();
        expect(writes).toEqual([]);
    });
}
