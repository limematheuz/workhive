import { expect, test } from "@playwright/test";

test.use({ timezoneId: "Europe/Madrid" });

for (const width of [390, 768, 1440]) {
    test(`task cards keep local scheduled times and date-only planning at ${width}px`, async ({ context, page }) => {
        test.skip(process.env.E2E_BASE_URL !== "http://localhost:3000", "Local UI regression only");
        await page.setViewportSize({ width, height: 1000 });
        const token = Buffer.from(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600 })).toString("base64url");
        await context.addCookies([{ name: "auth_token", value: `fixture.${token}.not-a-backend-token`, url: "http://localhost:3000" }]);
        await page.addInitScript(() => localStorage.setItem("locale", "es"));
        const tasks = [
            { id: 1, title: "QA Invierno", scheduled_start_at: "2026-11-13T08:00:00Z" },
            { id: 2, title: "QA Verano", scheduled_start_at: "2026-07-15T08:00:00Z" },
            { id: 3, title: "QA Solo fecha", scheduled_start_at: "2026-11-13T00:00:00.000Z" },
        ].map(task => ({ ...task, company_id: 1, location_id: 1, user_id: 1, status: "pending", priority: "low", unit: "service", quantity: 1, price: 0, created_at: "2026-11-12T09:00:00Z" }));
        await page.route("**/api/v1/**", async route => {
            const path = new URL(route.request().url()).pathname.replace(/\/$/, "");
            let body: unknown = [];
            if (path.endsWith("/users/me")) body = { id: 1, company_id: 1, full_name: "QA", role: { name: "admin" }, is_active: true };
            else if (path.endsWith("/companies/1")) body = { id: 1, name: "QA", onboarding_completed: true, subscription_status: "active" };
            else if (path.endsWith("/task-items")) body = tasks;
            else if (path.endsWith("/locations")) body = [{ id: 1, name: "QA Norte", is_active: true }];
            else if (path.endsWith("/work-sessions/active")) body = null;
            await route.fulfill({ json: body });
        });
        await page.goto("/dashboard/tasks");
        const card = (name: string) => page.locator("article").filter({ has: page.getByRole("button", { name: `Abrir tarea: ${name}`, exact: true }) });
        await expect(card("QA Invierno")).toContainText("13 nov, 09:00");
        await expect(card("QA Verano")).toContainText("15 jul, 10:00");
        await expect(card("QA Solo fecha").getByText("13 nov", { exact: true })).toBeVisible();
        await expect(card("QA Solo fecha")).not.toContainText("01:00");
    });
}
