import { expect, test } from "@playwright/test";

for (const width of [1440, 390]) {
    test(`invalid profile photo preserves draft and allows retry at ${width}px`, async ({ context, page }) => {
        test.skip(process.env.E2E_BASE_URL !== "http://localhost:3000", "Local intercepted UI only");
        const locale = "es";
        await page.setViewportSize({width, height: 1000});
        const payload = Buffer.from(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600 })).toString("base64url");
        await context.addCookies([{ name: "auth_token", value: `fixture.${payload}.not-a-backend-token`, url: process.env.E2E_BASE_URL! }]);
        await page.addInitScript(locale => localStorage.setItem("locale", locale), locale);

        let writes = 0;
        await page.route("**/api/v1/**", async route => {
            const path = new URL(route.request().url()).pathname.replace(/\/$/, "");
            let body: unknown = [];
            if (route.request().method() !== "GET") writes++;
            if (path === "/api/v1/users/me") body = { id: 36, full_name: "Administrador QA", email: "admin@example.test", company_id: 7, role: { id: 1, name: "admin" }, role_id: 1, is_active: true, can_view_finance: false };
            else if (path === "/api/v1/companies/7") body = { id: 7, name: "Empresa QA", tax_id: "B00000000", address: "Calle QA 1", onboarding_completed: true, subscription_status: "active" };
            else if (path.includes("entitlements")) body = { entitlements: [] };
            else if (path.includes("alert-count")) body = { pending_tasks: 0, unread_reports: 0, pending_requests: 0 };
            else if (path.includes("stats")) body = { total_hours: 0, total_tasks: 0, completed_tasks: 0 };
            await route.fulfill({ json: body });
        });

        const errors: string[] = [];
        page.on("console", message => { if (message.type() === "error") errors.push(message.text()); });
        await page.goto("/dashboard/profile");
        await page.getByRole("button", {name:"Editar Datos",exact:true}).click();
        const name = page.getByLabel("Nombre completo",{exact:true});
        await name.fill("Borrador QA");
        const upload = page.locator('input[type="file"]');
        await upload.setInputFiles({name:"corrupt.png",mimeType:"image/png",buffer:Buffer.from("invalid image")});
        await expect(page.getByText("Error al optimizar la imagen",{exact:true})).toBeVisible();
        await expect(name).toHaveValue("Borrador QA");
        await expect(page.getByRole("button",{name:"Quitar foto",exact:true})).toHaveCount(0);
        expect(errors.filter(message=>message.includes("Error compressing image"))).toEqual([]);
        expect(writes).toBe(0);
        await upload.setInputFiles(new URL("../public/logo/black-logo.png", import.meta.url).pathname);
        await expect(page.getByText("Imagen optimizada lista para guardar",{exact:true})).toBeVisible();
        await expect(page.getByRole("button",{name:"Quitar foto",exact:true})).toBeVisible();
        await expect(name).toHaveValue("Borrador QA");
        expect(writes).toBe(0);
    });
}
