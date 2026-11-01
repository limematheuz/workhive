import { expect, test } from "@playwright/test";
import { qualityAccessFixture } from "./helpers/quality-access";
import { selectSection } from "./helpers/select-section";

for (const width of [1440, 768, 390]) for (const manage of [true, false]) {
    test(`quality incident status manage=${manage} at ${width}px`, async ({ context, page }, testInfo) => {
        test.skip(process.env.E2E_BASE_URL !== "http://localhost:3000", "Local UI regression only");
        await page.setViewportSize({ width, height: 1000 });
        const token = Buffer.from(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600 })).toString("base64url");
        await context.addCookies([{ name: "auth_token", value: `fixture.${token}.not-a-backend-token`, url: "http://localhost:3000" }]);
        await page.addInitScript(() => localStorage.setItem("locale", "es"));
        const incident = { id: 2, location_id: 15, title: "QA incidencia de estado", severity: "medium", status: "open", resolved_at: null as string | null, created_at: "2026-11-01T12:00:00Z", evidence: [], corrective_actions: [{ id: 1, title: "QA acción conservada", status: "pending", due_at: null, completed_at: null }] };
        const writes: unknown[] = [];
        const retry = width === 1440 && manage;
        let failOnce = retry;
        await page.route("**/api/v1/**", async route => {
            const path = new URL(route.request().url()).pathname.replace(/\/$/, "");
            let body: unknown = [];
            if (path === "/api/v1/users/me") body = { id: 1, full_name: "QA", role: { name: manage ? "admin" : "viewer" }, company_id: 1, is_active: true, can_view_quality: true, can_manage_quality: manage };
            else if (path.endsWith("organization/access")) body = Object.fromEntries(["templates", "inspections", "incidents", "complaints"].flatMap(section => [[`quality.${section}.read`, true], [`quality.${section}.manage`, manage]]));
            else if (path === "/api/v1/quality/access") body = qualityAccessFixture(Object.fromEntries(["templates", "inspections", "incidents", "complaints"].flatMap(section => [[`quality.${section}.read`, true], [`quality.${section}.manage`, manage]])));
            else if (path === "/api/v1/companies/1") body = { id: 1, name: "QA", onboarding_completed: true, subscription_status: "active" };
            else if (path === "/api/v1/quality/incidents/2" && route.request().method() === "PATCH") {
                const payload = route.request().postDataJSON();
                writes.push(payload);
                if (failOnce) {
                    failOnce = false;
                    await route.fulfill({ status: 503, json: { detail: "QA fallo temporal" } });
                    return;
                }
                incident.status = payload.status;
                incident.resolved_at = ["resolved", "closed"].includes(payload.status) ? "2026-11-01T13:00:00Z" : null;
                // A status response must not overwrite independently maintained actions.
                body = { ...incident, corrective_actions: [] };
            } else if (path === "/api/v1/quality/incidents") body = [incident];
            await route.fulfill({ json: body });
        });
        await page.goto("/dashboard/quality");
        await selectSection(page, page, "Incidencias");
        await page.getByText(incident.title, { exact: true }).filter({ visible: true }).click();
        const dialog = page.getByRole("dialog", { name: "Acciones correctivas", exact: true });
        const status = dialog.getByRole("combobox", { name: "Estado de la incidencia", exact: true });
        if (!manage) {
            await expect(status).toHaveCount(0);
            await expect(dialog.getByText("Abierta", { exact: true })).toBeVisible();
            expect(writes).toEqual([]);
        } else {
            await expect(status).toBeVisible();
            if (retry) {
                const draft = dialog.getByRole("textbox", { name: "Acción", exact: true });
                await draft.fill("QA borrador conservado");
                await status.click();
                await page.getByRole("option", { name: "Resuelta", exact: true }).click();
                await expect(page.getByText("No se pudo actualizar el estado de la incidencia.", { exact: true })).toBeVisible();
                await expect(page.getByText("QA fallo temporal", { exact: true })).toHaveCount(0);
                await expect(status).toBeEnabled();
                await expect(status).toHaveText("Abierta");
                await expect(draft).toHaveValue("QA borrador conservado");
                await status.click();
                await page.getByRole("option", { name: "Resuelta", exact: true }).click();
                await expect(status).toBeEnabled();
                await expect(status).toHaveText("Resuelta");
                await expect(draft).toHaveValue("QA borrador conservado");
                await draft.fill("");
            }
            for (const [value, label] of [["in_progress", "En curso"], ["resolved", "Resuelta"], ["closed", "Cerrada"], ["open", "Abierta"], ["closed", "Cerrada"]]) {
                await status.click();
                await page.getByRole("option", { name: label, exact: true }).click();
                await expect(status).toHaveText(label);
                await expect(status).toBeEnabled();
                expect(writes.at(-1)).toEqual({ status: value });
                await expect(dialog.getByText("QA acción conservada", { exact: true })).toBeVisible();
            }
            await dialog.getByRole("button", { name: "Cerrar", exact: true }).click();
            await expect(dialog).not.toBeVisible();
            await expect(page.getByRole("alertdialog")).toHaveCount(0);
            await page.reload();
            await selectSection(page, page, "Incidencias");
            await page.getByText(incident.title, { exact: true }).filter({ visible: true }).click();
            await expect(status).toHaveText("Cerrada");
            expect(writes).toHaveLength(retry ? 7 : 5);
        }
        await page.screenshot({ path: testInfo.outputPath("incident-status.png"), fullPage: true });
    });
}
