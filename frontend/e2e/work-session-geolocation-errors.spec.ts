import { expect, test } from "@playwright/test";
import { setupNotificationWorkspace } from "./helpers/notification-workspace";

for (const locale of ["es", "en"] as const) for (const failure of ["denied", "unavailable", "timeout", "unsupported"] as const) {
    test(`clock-in stays unchanged after geolocation ${failure} in ${locale}`, async ({ context, page }) => {
        test.skip(process.env.E2E_BASE_URL !== "http://localhost:3000", "Local intercepted UI only");
        await page.setViewportSize({ width: locale === "es" ? 390 : 1440, height: 1000 });
        await context.clearPermissions();
        if (failure !== "denied") await page.addInitScript(mode => {
            Object.defineProperty(navigator, "geolocation", { configurable: true, value: mode === "unsupported" ? undefined : {
                getCurrentPosition: (_success: unknown, error: PositionErrorCallback) => error({ code: mode === "timeout" ? 3 : 2, message: mode, PERMISSION_DENIED: 1, POSITION_UNAVAILABLE: 2, TIMEOUT: 3 }),
            } });
        }, failure);
        await setupNotificationWorkspace(context, page, true, "/dashboard", { locale });
        const task = { id: 5, company_id: 1, title: "QA geolocation failure", user_id: 1, location_id: 15, status: "accepted", priority: "medium", unit: "servicio", created_at: new Date().toISOString(), description: "- [ ] Revisar entrada" };
        await page.route("**/api/v1/task-items/**", route => {
            const path = new URL(route.request().url()).pathname.replace(/\/$/, "");
            return route.fulfill({ json: path.endsWith("/5") ? task : [task] });
        });
        let writes = 0;
        await page.route("**/api/v1/**", async (route, request) => {
            if (request.method() !== "GET" && /\/(start-work|work-sessions\/start|work-sessions\/stop)$/.test(new URL(request.url()).pathname)) {
                writes++;
                return route.fulfill({ status: 500, json: { detail: "Clock mutations must not run without geolocation" } });
            }
            return route.fallback();
        });
        await page.reload();
        const panel = page.getByRole("region", { name: locale === "es" ? "Tu jornada" : "Your shift", exact: true });
        await panel.getByRole("button", { name: locale === "es" ? "Abrir trabajo" : "Open job", exact: true }).click();
        const dialog = page.getByRole("dialog", { name: "QA geolocation failure", exact: true });
        const start = dialog.getByRole("button", { name: locale === "es" ? "Iniciar Jornada de Trabajo" : "Start Work Shift", exact: true });
        await start.click();
        const messages = {
            es: { denied: "Debes permitir la ubicación precisa para iniciar el fichaje.", unavailable: "No se ha podido obtener tu ubicación. Comprueba el servicio de ubicación e inténtalo de nuevo.", timeout: "La ubicación ha tardado demasiado. Inténtalo de nuevo.", unsupported: "Este navegador no permite obtener tu ubicación. Usa un navegador compatible." },
            en: { denied: "You must allow precise location access to start the shift.", unavailable: "Your location could not be obtained. Check location services and try again.", timeout: "Getting your location took too long. Please try again.", unsupported: "This browser cannot obtain your location. Use a supported browser." },
        };
        await expect(page.getByText(messages[locale][failure], { exact: true })).toBeVisible();
        await expect(start).toBeEnabled();
        await expect(panel.getByRole("timer")).toHaveCount(0);
        expect(writes).toBe(0);
        await expect(dialog.getByRole("heading", { name: "QA geolocation failure", exact: true, level: 1 })).toBeVisible();
    });
}
