import { expect, test } from "@playwright/test";

function makeFakeToken() {
    const payload = Buffer.from(
        JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600 }),
    ).toString("base64url");
    return `fixture.${payload}.not-a-backend-token`;
}

const baseQuote = {
    id: 10,
    quote_number: "QUO-2026-0010",
    client_id: 1,
    company_id: 1,
    status: "draft",
    title: "Servicio Exento QA",
    revision_number: 1,
    created_at: "2026-11-14T10:00:00Z",
    valid_until: "2026-12-31",
    total_amount: 180,
    base_amount: 180,
    tax_amount: 0,
    discount: 10,
    retention: 0,
    equivalence_surcharge: 0,
    tax_rate: 0,
    accepted_revision_id: null,
    items: [
        {
            id: 101,
            quote_id: 10,
            description: "Limpieza técnica exenta",
            quantity: 2,
            unit_price: 100,
            subtotal: 200,
        },
    ],
};

test.describe("Quotes QA regressions", () => {
    test.beforeEach(async ({ context, page }) => {
        test.skip(process.env.E2E_BASE_URL !== "http://localhost:3000", "Local UI regression only");
        await context.addCookies([
            { name: "auth_token", value: makeFakeToken(), url: "http://localhost:3000" },
        ]);
        await page.addInitScript(() => {
            localStorage.setItem("locale", "es");
        });
    });

    test("Cancel button triggers unsaved-changes confirmation and 0% IVA is preserved on edit", async ({ page }) => {
        await page.setViewportSize({ width: 1440, height: 900 });
        await page.route("**/api/v1/**", async (route) => {
            const path = new URL(route.request().url()).pathname.replace(/\/$/, "");
            if (path === "/api/v1/users/me") {
                return route.fulfill({
                    json: {
                        id: 1,
                        full_name: "Admin QA",
                        role: { name: "admin" },
                        company_id: 1,
                        is_active: true,
                        can_view_finance: true,
                        can_manage_finance: true,
                    },
                });
            }
            if (path === "/api/v1/companies/1") {
                return route.fulfill({
                    json: { id: 1, name: "Empresa QA", onboarding_completed: true, subscription_status: "active" },
                });
            }
            if (path === "/api/v1/quotes") return route.fulfill({ json: [baseQuote] });
            if (path === "/api/v1/quotes/10") return route.fulfill({ json: baseQuote });
            if (path === "/api/v1/clients") return route.fulfill({ json: [{ id: 1, name: "Cliente QA" }] });
            if (path.includes("alert-count")) return route.fulfill({ json: { pending_requests: 0, pending_tasks: 0, unread_reports: 0 } });
            return route.fulfill({ json: [] });
        });

        await page.goto("/dashboard/quotes");
        await page.getByRole("button", { name: /Nuevo Presupuesto/i }).click();

        const dialog = page.getByRole("dialog");
        await expect(dialog).toBeVisible();
        await dialog.locator("input").first().fill("Borrador con cambios");
        await dialog.getByRole("button", { name: "Cancelar" }).click();

        const alert = page.getByRole("alertdialog");
        await expect(alert).toBeVisible();
        await alert.getByRole("button", { name: /Salir sin guardar/i }).click();
        await expect(dialog).toBeHidden();

        // Edit the 0% IVA draft quote from row action menu and check IVA selector keeps 0%
        await page.getByRole("button", { name: "Open actions menu" }).first().click();
        await page.getByRole("menuitem", { name: "Editar" }).click();
        const editDialog = page.getByRole("dialog");
        await expect(editDialog).toBeVisible();
        await expect(editDialog.getByRole("combobox", { name: "Tipo de IVA" })).toContainText("No aplica (0%)");
    });

    test("QuotesPage avoids false empty state on 503 and does not open stale detail", async ({ page }) => {
        await page.setViewportSize({ width: 390, height: 844 });
        let detailFails = false;
        let listFails = true;

        await page.route("**/api/v1/**", async (route) => {
            const path = new URL(route.request().url()).pathname.replace(/\/$/, "");
            if (path === "/api/v1/users/me") {
                return route.fulfill({
                    json: {
                        id: 2,
                        full_name: "Finanzas QA",
                        role: { name: "viewer" },
                        company_id: 1,
                        is_active: true,
                        can_view_finance: true,
                        can_manage_finance: false,
                    },
                });
            }
            if (path === "/api/v1/companies/1") {
                return route.fulfill({
                    json: { id: 1, name: "Empresa QA", onboarding_completed: true, subscription_status: "active" },
                });
            }
            if (path === "/api/v1/clients") {
                return route.fulfill({ status: 403, json: { detail: "Not enough permissions" } });
            }
            if (path === "/api/v1/quotes") {
                if (listFails) return route.fulfill({ status: 503, json: { detail: "Unavailable" } });
                return route.fulfill({ json: [baseQuote] });
            }
            if (path === "/api/v1/quotes/10") {
                if (detailFails) return route.fulfill({ status: 503, json: { detail: "Unavailable" } });
                return route.fulfill({ json: baseQuote });
            }
            if (path.includes("alert-count")) return route.fulfill({ json: { pending_requests: 0, pending_tasks: 0, unread_reports: 0 } });
            return route.fulfill({ json: [] });
        });

        await page.goto("/dashboard/quotes");
        await expect(page.getByText(/No hay presupuestos/i)).toHaveCount(0);
        await expect(page.getByText(/No se pudieron cargar los presupuestos/i).first()).toBeVisible();

        const hasOverflow = await page.evaluate(
            () => document.documentElement.scrollWidth > window.innerWidth,
        );
        expect(hasOverflow).toBe(false);

        listFails = false;
        detailFails = true;
        await page.reload();
        const quoteCardButton = page.getByRole("button", { name: /QUO-2026-0010/i });
        await expect(quoteCardButton).toBeVisible();
        await quoteCardButton.click();
        await expect(page.getByRole("dialog")).toHaveCount(0);
    });
});
