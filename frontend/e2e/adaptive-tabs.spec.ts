import { selectSection } from "./helpers/select-section";
import { expect, test, type Page } from "@playwright/test";

async function expectControlsContained(page: Page, names: string[]) {
    for (const name of names) {
        const control = name.startsWith("Añadir")
            ? page.getByRole("button", { name, exact: true })
            : page.getByLabel(name, { exact: true });
        const bounds = await control.evaluate(element => {
            const r = element.getBoundingClientRect();
            return { left: r.left, right: r.right, viewport: window.innerWidth };
        });
        expect(bounds.left).toBeGreaterThanOrEqual(0);
        expect(bounds.right).toBeLessThanOrEqual(bounds.viewport);
    }
}

for (const width of [390, 751, 768, 1440]) {
    test(`login exposes both navigation tabs at ${width}px`, async ({ page }) => {
        test.skip(process.env.E2E_BASE_URL !== "http://localhost:3000", "Local UI regression only");
        await page.setViewportSize({ width, height: 900 });
        await page.addInitScript(() => localStorage.setItem("locale", "es"));
        await page.goto("/login");
        await expect(page.getByRole("tab", { name: "Iniciar sesión", exact: true })).toBeVisible();
        await expect(page.getByRole("tab", { name: "Solicitar acceso", exact: true })).toBeVisible();
        await page.getByRole("tab", { name: "Solicitar acceso", exact: true }).click();
        await expect(page).toHaveURL(/\/register/);
    });
}

for (const width of [390, 768, 1024, 1440]) {
    for (const count of [6, 7]) {
        test(`inventory preserves ${count} views at ${width}px`, async ({ context, page }) => {
            test.skip(process.env.E2E_BASE_URL !== "http://localhost:3000", "Local UI regression only");
            await page.setViewportSize({ width, height: 900 });
            const token = Buffer.from(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600 })).toString("base64url");
            await context.addCookies([{ name: "auth_token", value: `fixture.${token}.not-a-backend-token`, url: "http://localhost:3000" }]);
            await page.addInitScript(() => localStorage.setItem("locale", "es"));
            await page.route("**/api/v1/**", async route => {
                const path = new URL(route.request().url()).pathname.replace(/\/$/, "");
                let body: unknown = [];
                if (path === "/api/v1/users/me") body = { id: 1, full_name: "QA", role: { name: "admin" }, company_id: 1, is_active: true, can_view_finance: count === 7 };
                else if (path === "/api/v1/companies/1") body = { id: 1, name: "QA", onboarding_completed: true, subscription_status: "active" };
                else if (path.endsWith("/organization/access")) body = { "inventory.read": true, "inventory.manage": true };
                else if (path.includes("alert-count")) body = { pending_requests: 0, pending_tasks: 0, unread_reports: 0 };
                await route.fulfill({ json: body });
            });
            await page.goto("/dashboard/inventory");
            const nav = page.getByRole("region", { name: "Secciones de inventario", exact: true });
            await expect(nav).toBeVisible();
            await selectSection(nav, page, "Movimientos", "Vista: Operativa");
            await selectSection(nav, page, "Catálogo", "Área de inventario");
            await selectSection(nav, page, "Almacenes", "Vista: Catálogo");
            await expectControlsContained(page, ["Nombre del almacén", "Dirección del almacén", "Añadir almacén"]);
            await selectSection(nav, page, "Operativa", "Área de inventario");
            const selectedView = async (name: string) => {
                const tab = nav.getByRole("tab", { name, exact: true });
                if (await tab.isVisible()) await expect(tab).toHaveAttribute("aria-selected", "true");
                else await expect(nav.getByRole("combobox").last()).toContainText(name);
            };
            await selectedView("Movimientos");
            await selectSection(nav, page, "Catálogo", "Área de inventario");
            await selectedView("Almacenes");
            await selectSection(nav, page, "Materiales", "Vista: Catálogo");
            await expectControlsContained(page, ["SKU", "Nombre del material", "Unidad", "Proveedor preferido", "Punto de reposición", "Añadir material"]);
            await selectSection(nav, page, "Proveedores", "Vista: Catálogo");
            await expectControlsContained(page, ["Nombre del proveedor", "Correo del proveedor", "Añadir proveedor"]);
            await selectSection(nav, page, "Operativa", "Área de inventario");
            await selectSection(nav, page, "Stock", "Vista: Operativa");
            await selectSection(nav, page, "Lotes", "Vista: Operativa");
            if (count === 7) {
                await selectSection(nav, page, "Compras", "Área de inventario");
                await expect(nav.locator("[data-tab-navigation]")).toHaveCount(1);
                await selectSection(nav, page, "Operativa", "Área de inventario");
                await selectedView("Lotes");
            } else await expect(nav.getByRole("tab", { name: "Compras", exact: true })).toHaveCount(0);
            await page.setViewportSize({ width: 1440, height: 900 });
            await expect(nav.getByRole("tab", { name: "Lotes", exact: true })).toHaveAttribute("aria-selected", "true");
            const geometry = await nav.evaluate(element => ({ width: element.clientWidth, scrollWidth: element.scrollWidth }));
            expect(geometry.scrollWidth).toBeLessThanOrEqual(geometry.width + 1);
        });
    }
}

for (const width of [390, 768, 1440]) {
    test(`location wizard preserves all steps and guards drafts at ${width}px`, async ({ context, page }) => {
        test.skip(process.env.E2E_BASE_URL !== "http://localhost:3000", "Local UI regression only");
        await page.setViewportSize({ width, height: 900 });
        const token = Buffer.from(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600 })).toString("base64url");
        await context.addCookies([{ name: "auth_token", value: `fixture.${token}.not-a-backend-token`, url: "http://localhost:3000" }]);
        await page.addInitScript(() => localStorage.setItem("locale", "es"));
        let writes = 0;
        await page.route("**/api/v1/**", async route => {
            const path = new URL(route.request().url()).pathname.replace(/\/$/, "");
            let body: unknown = [];
            if (path === "/api/v1/users/me") body = { id: 1, full_name: "QA", role: { name: "admin" }, company_id: 1, is_active: true };
            else if (path === "/api/v1/companies/1") body = { id: 1, name: "QA", onboarding_completed: true, subscription_status: "active" };
            else if (path === "/api/v1/locations/catalog") body = { site_types: [], attributes: [], features: [] };
            else if (path === "/api/v1/locations" && route.request().method() === "POST") writes++;
            else if (path.includes("alert-count")) body = { pending_requests: 0, pending_tasks: 0, unread_reports: 0 };
            await route.fulfill({ json: body });
        });
        await page.goto("/dashboard/locations");
        await page.getByRole("button", { name: "Nueva Ubicación", exact: true }).click();
        const wizard = page.getByRole("dialog", { name: "Nueva ubicación", exact: true });
        await expect(wizard.getByRole("tabpanel", { name: "Información", exact: true })).toBeVisible();
        await wizard.getByRole("button", { name: "Siguiente", exact: true }).click();
        await expect(wizard.getByRole("tabpanel", { name: "Información", exact: true })).toBeVisible();
        const headerClearance = await wizard.evaluate(element => {
            const close = element.querySelector('[data-slot="dialog-close"]')!.getBoundingClientRect();
            const description = element.querySelector('[data-slot="dialog-description"]')!.getBoundingClientRect();
            return { right: description.right, closeLeft: close.left };
        });
        expect(headerClearance.right).toBeLessThanOrEqual(headerClearance.closeLeft);
        await selectSection(wizard, page, /^4\./, "Pasos de la ubicación");
        await wizard.getByRole("button", { name: "Cancelar", exact: true }).click();
        await expect(page.getByRole("alertdialog")).toHaveCount(0);
        await expect(wizard).toHaveCount(0);
        await page.getByRole("button", { name: "Nueva Ubicación", exact: true }).click();
        await wizard.getByRole("textbox", { name: "Nombre *", exact: true }).fill("QA borrador de ubicación");
        for (const [number, name] of [[2, "Tipo"], [3, "Operación"], [4, "Espacios"]] as const) {
            await selectSection(wizard, page, new RegExp(`^${number}\\.`), "Pasos de la ubicación");
            await expect(wizard.getByRole("tabpanel", { name, exact: true })).toBeVisible();
        }
        await page.setViewportSize({ width: width === 1440 ? 390 : 1440, height: 900 });
        await selectSection(wizard, page, /^1\./, "Pasos de la ubicación");
        await expect(wizard.getByRole("textbox", { name: "Nombre *", exact: true })).toHaveValue("QA borrador de ubicación");
        await wizard.getByRole("button", { name: "Cancelar", exact: true }).click();
        await expect(page.getByRole("alertdialog")).toBeVisible();
        await page.getByRole("button", { name: "Salir sin guardar", exact: true }).click();
        await expect(wizard).toHaveCount(0);
        expect(writes).toBe(0);
    });
}
