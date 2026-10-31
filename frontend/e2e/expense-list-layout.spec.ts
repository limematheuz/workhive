import { expect, test } from "@playwright/test";

const description = "QA compra consumo orden 20261031 con concepto completo";
const vendor = "QA proveedor ciclo orden 20261031";
for (const locale of ["es", "en"]) {
    for (const width of [1440, 1032, 768, 390]) {
        test(`expense details and category remain complete at ${width}px in ${locale}`, async ({ context, page }) => {
            test.skip(process.env.E2E_BASE_URL !== "http://localhost:3000", "Local UI regression only");
            await page.setViewportSize({ width, height: 1000 });
            const token = Buffer.from(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600 })).toString("base64url");
            await context.addCookies([{ name: "auth_token", value: `fixture.${token}.not-a-backend-token`, url: "http://localhost:3000" }]);
            await page.addInitScript(value => localStorage.setItem("locale", value), locale);
            let writes = 0;
            await page.route("**/api/v1/**", async route => {
                const path = new URL(route.request().url()).pathname.replace(/\/$/, "");
                if (route.request().method() !== "GET") writes++;
                let body: unknown = [];
                if (path === "/api/v1/users/me") body = { id: 1, full_name: "QA", role: { name: "admin" }, company_id: 1, is_active: true, can_view_finance: true };
                else if (path === "/api/v1/companies/1") body = { id: 1, name: "QA", onboarding_completed: true, subscription_status: "active" };
                else if (path === "/api/v1/expenses") body = [{ id: 1, expense_date: new Date().toISOString(), description, vendor, category: "supplies", base_amount: 123456.78, tax_amount: 25925.92, total_amount: 149382.70, notes: "QA internal note", is_active: true }];
                await route.fulfill({ json: body });
            });
            await page.goto("/dashboard/expenses");
            for (const text of [description, vendor, locale === "es" ? "Suministros" : "Supplies"]) {
                const label = page.getByText(text, { exact: true }).filter({ visible: true });
                await expect(label).toBeVisible();
                const geometry = await label.evaluate(element => ({ content: element.scrollWidth, available: element.clientWidth }));
                expect(geometry.content).toBeLessThanOrEqual(geometry.available + 1);
            }
            const dateFit = await page.getByRole("textbox", { name: locale === "es" ? "Mes" : "Month", exact: true }).evaluate(element => {
                const input = element as HTMLInputElement;
                const style = getComputedStyle(input);
                const canvas = document.createElement("canvas");
                const context = canvas.getContext("2d")!;
                context.font = style.font;
                return { available: input.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight), required: context.measureText(input.value).width };
            });
            expect(dateFit.available).toBeGreaterThanOrEqual(dateFit.required - 1);
            const actions = page.getByRole("button", { name: locale === "es" ? "Acciones" : "Actions", exact: true }).filter({ visible: true });
            await actions.click();
            await expect(page.getByRole("menuitem", { name: locale === "es" ? "Editar" : "Edit", exact: true })).toBeVisible();
            expect(writes).toBe(0);
        });
    }
}
