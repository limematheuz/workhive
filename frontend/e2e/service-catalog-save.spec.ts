import { expect, test } from "@playwright/test";

for (const editing of [false, true]) for (const locale of ["es", "en"] as const) for (const width of [390, 768, 1440]) {
    test(`catalog save is exclusive and confirmed without a second list read: edit=${editing} ${locale} ${width}px`, async ({ context, page }) => {
        test.skip(process.env.E2E_BASE_URL !== "http://localhost:3000", "Local UI regression only");
        await page.setViewportSize({ width, height: 1000 });
        const token = Buffer.from(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600 })).toString("base64url");
        await context.addCookies([{ name: "auth_token", value: `fixture.${token}.not-a-backend-token`, url: "http://localhost:3000" }]);
        await page.addInitScript(locale => localStorage.setItem("locale", locale), locale);
        let release!: () => void;
        const held = new Promise<void>(resolve => { release = resolve; });
        let writes = 0;
        let successfulWrites = 0;
        let listReads = 0;
        const failFirst = !editing && locale === "es";
        const original = { id: 1, company_id: 1, name: "QA Servicio", description: "- [ ] Paso QA", default_price: 0, unit: "visita", is_active: true, catalog_version: 1 };
        await page.route("**/api/v1/**", async route => {
            const path = new URL(route.request().url()).pathname.replace(/\/$/, "");
            const method = route.request().method();
            let body: unknown = [];
            if (path.endsWith("/users/me")) body = { id: 1, company_id: 1, full_name: "QA", role: { name: "admin" }, is_active: true };
            else if (path.endsWith("/companies/1")) body = { id: 1, name: "QA", onboarding_completed: true, subscription_status: "active" };
            else if ((path.endsWith("/template-tasks") && method === "POST") || (path.endsWith("/template-tasks/1") && method === "PATCH")) {
                writes++;
                await held;
                if (failFirst && writes === 1) { await route.fulfill({ status: 503, json: { detail: "Service unavailable" } }); return; }
                successfulWrites++;
                body = { ...original, ...route.request().postDataJSON(), id: editing ? 1 : 2, catalog_version: editing ? 2 : 1 };
            } else if (path.endsWith("/template-tasks") && method === "GET") {
                listReads++;
                if (writes > 0) { await route.fulfill({ status: 503, json: { detail: "Unavailable" } }); return; }
                body = [original];
            }
            await route.fulfill({ json: body });
        });
        await page.goto("/dashboard/tasks");
        const navigation = page.locator('[data-tab-navigation][data-tabs-ready="true"]').filter({ visible: true });
        await expect(navigation).toBeVisible();
        const catalogLabel = locale === "es" ? "Catálogo de servicios" : "Service catalog";
        const catalogTab = navigation.getByRole("tab", { name: catalogLabel, exact: true });
        if (await catalogTab.count()) await catalogTab.click();
        else { await navigation.getByRole("combobox").click(); await page.getByRole("option", { name: catalogLabel, exact: true }).click(); }
        if (editing) {
            await page.getByRole("button", { name: "Open actions menu", exact: true }).filter({ visible: true }).click();
            await page.getByRole("menuitem", { name: locale === "es" ? "Editar" : "Edit", exact: true }).click();
        } else {
            await page.getByRole("button", { name: locale === "es" ? "Crear Plantilla" : "Create Template", exact: true }).click();
        }
        const dialog = page.getByRole("dialog");
        await dialog.locator("#template-name").fill("QA Servicio guardado");
        await dialog.locator("#template-price").fill("7.5");
        await expect(dialog.locator("#template-unit")).toContainText(editing ? "visita" : "unidad");
        const submit = dialog.locator('button[type="submit"]');
        await submit.click();
        try {
            await expect(submit).toBeDisabled();
            await expect.poll(() => writes).toBe(1);
            await dialog.locator("#template-name").press("Enter");
            expect(writes).toBe(1);
        } finally { release(); }
        if (failFirst) {
            await expect(page.getByText("No se pudo guardar el servicio. Revisa los datos e inténtalo de nuevo.", { exact: true })).toBeVisible();
            await expect(dialog.locator("#template-name")).toHaveValue("QA Servicio guardado");
            await expect(dialog.locator("#template-price")).toHaveValue("7.5");
            await expect(submit).toBeEnabled();
            await submit.click();
        }
        await expect(dialog).toHaveCount(0);
        await expect(page.getByText("QA Servicio guardado", { exact: true }).filter({ visible: true })).toBeVisible();
        expect(writes).toBe(failFirst ? 2 : 1);
        expect(successfulWrites).toBe(1);
        expect(listReads).toBe(1);
    });
}
