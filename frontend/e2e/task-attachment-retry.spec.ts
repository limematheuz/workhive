import { expect, test, type BrowserContext, type Page } from "@playwright/test";

// Isolated API fixtures: no real account, upload, task or report is modified.
async function openAttachments(context: BrowserContext, page: Page, width: number, failure: "upload" | "report") {
    await page.setViewportSize({ width, height: 900 });
    const token = Buffer.from(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600 })).toString("base64url");
    await context.addCookies([{ name: "auth_token", value: `fixture.${token}.not-a-backend-token`, url: "http://localhost:3000" }]);
    await page.addInitScript(() => localStorage.setItem("locale", "es"));
    const now = new Date().toISOString();
    const task = {
        id: 1, title: "QA reintento adjunto", unit: "servicio", price: 1, quantity: 1,
        status: "pending", priority: "high", company_id: 1, location_id: 1, created_at: now,
        scheduled_start_at: now, due_at: now, description: "QA instrucciones", checklist_evidence: {},
        checklist_items: [], assignments: [{ user_id: 1, user_name: "QA", status: "pending", source: "direct" }],
    };
    let fail = true;
    let uploads = 0;
    let reports = 0;
    const saved: Record<string, unknown>[] = [];
    await page.route("**/api/v1/**", async route => {
        const path = new URL(route.request().url()).pathname.replace(/\/$/, "");
        let body: unknown = [];
        if (path === "/api/v1/users/me") body = { id: 1, full_name: "QA", role: { name: "viewer" }, company_id: 1, is_active: true };
        else if (path === "/api/v1/companies/1") body = { id: 1, name: "QA", onboarding_completed: true, subscription_status: "active" };
        else if (path === "/api/v1/task-items") body = [task];
        else if (path === "/api/v1/task-items/1") body = task;
        else if (path === "/api/v1/locations") body = [{ id: 1, name: "QA ubicación", address: "QA", city: "QA", is_active: true }];
        else if (path === "/api/v1/work-sessions/active") body = null;
        else if (path.endsWith("/detailed-summary")) body = { total_seconds: 0, active_workers: 0, workers: [] };
        else if (path.endsWith("/detailed-summaries")) body = { summaries: [] };
        else if (path.includes("alert-count")) body = { pending_requests: 0, pending_tasks: 0, unread_reports: 0 };
        else if (path === "/api/v1/uploads") {
            uploads++;
            if (fail && failure === "upload") return route.fulfill({ status: 500, json: { detail: "QA upload failure" } });
            body = { url: "/api/v1/uploads/media/company/1/location/qa.png" };
        } else if (path === "/api/v1/task-reports" && route.request().method() === "POST") {
            reports++;
            if (fail && failure === "report") return route.fulfill({ status: 500, json: { detail: "QA report failure" } });
            const payload = route.request().postDataJSON();
            saved.push(payload);
            body = { id: 1, ...payload };
        }
        await route.fulfill({ json: body });
    });
    await page.goto("/dashboard");
    await page.getByRole("button", { name: task.title, exact: true }).click();
    await page.getByRole("button", { name: /enviar foto/i }).click();
    const dialog = page.getByRole("dialog", { name: "Archivos Adjuntos", exact: true });
    await expect(dialog).toBeVisible();
    return { dialog, uploads: () => uploads, reports: () => reports, saved, recover: () => { fail = false; } };
}

const photo = {
    name: "qa-retry.png", mimeType: "image/png",
    buffer: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jT1sAAAAASUVORK5CYII=", "base64"),
};
for (const width of [1440, 768, 390]) {
    for (const failure of ["upload", "report"] as const) {
        test(`same photo can retry after ${failure} failure at ${width}px`, async ({ context, page }) => {
            test.skip(process.env.E2E_BASE_URL !== "http://localhost:3000", "Local UI regression only");
            const state = await openAttachments(context, page, width, failure);
            const input = state.dialog.locator('input[type="file"]');
            const choose = async (cancel = false) => {
                const chooserPromise = page.waitForEvent("filechooser");
                await state.dialog.getByText("Hacer o subir foto", { exact: true }).click();
                const chooser = await chooserPromise;
                await chooser.setFiles(cancel ? [] : photo);
            };
            await choose(true);
            expect(state.uploads()).toBe(0);
            await choose();
            await expect(page.getByText("Error al subir el archivo", { exact: true })).toBeVisible();
            await expect(input).toBeEnabled();
            await expect(input).toHaveValue("");
            expect(state.uploads()).toBe(1);
            expect(state.reports()).toBe(failure === "upload" ? 0 : 1);
            expect(state.saved).toHaveLength(0);
            state.recover();
            await choose();
            await expect(page.getByText("Foto adjuntada y guardada con éxito", { exact: true })).toBeVisible();
            expect(state.uploads()).toBe(2);
            expect(state.saved).toHaveLength(1);
            expect(state.saved[0]).toMatchObject({ task_item_id: 1, report_type: "photo", file_name: photo.name });
            await expect(input).toHaveValue("");
            const geometry = await state.dialog.evaluate(element => ({ width: element.clientWidth, scrollWidth: element.scrollWidth }));
            expect(geometry.scrollWidth).toBeLessThanOrEqual(geometry.width + 1);
            await state.dialog.getByRole("button", { name: "Close", exact: true }).click();
            await expect(page.getByRole("alertdialog")).toHaveCount(0);
            await expect(state.dialog).toHaveCount(0);
        });
    }
}

test("failed upload closes without an unsaved draft", async ({ context, page }) => {
    test.skip(process.env.E2E_BASE_URL !== "http://localhost:3000", "Local UI regression only");
    const state = await openAttachments(context, page, 390, "upload");
    await state.dialog.locator('input[type="file"]').setInputFiles(photo);
    await expect(page.getByText("Error al subir el archivo", { exact: true })).toBeVisible();
    await state.dialog.getByRole("button", { name: "Close", exact: true }).click();
    await expect(page.getByRole("alertdialog")).toHaveCount(0);
    await expect(state.dialog).toHaveCount(0);
    expect(state.saved).toHaveLength(0);
});
