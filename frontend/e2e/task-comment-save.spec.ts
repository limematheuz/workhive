import { expect, test, type BrowserContext, type Page } from "@playwright/test";

// API fixtures isolate these interactions from real accounts and task history.
async function openComments(context: BrowserContext, page: Page, width: number) {
    await page.setViewportSize({ width, height: 900 });
    const token = Buffer.from(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600 })).toString("base64url");
    await context.addCookies([{ name: "auth_token", value: `fixture.${token}.not-a-backend-token`, url: "http://localhost:3000" }]);
    await page.addInitScript(() => localStorage.setItem("locale", "es"));
    const task = {
        id: 1, title: "QA notas del servicio", company_id: 1, location_id: 1,
        status: "pending", priority: "medium", unit: "servicio", price: 1, quantity: 1,
        created_at: new Date().toISOString(), description: "QA instrucciones", checklist_items: [],
        assignments: [{ user_id: 1, user_name: "QA", status: "pending", source: "direct" }],
    };
    let fail = false;
    let release: (() => void) | undefined;
    let hold: Promise<void> | undefined;
    const submissions: Record<string, unknown>[] = [];
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
        else if (path === "/api/v1/task-reports" && route.request().method() === "POST") {
            const payload = route.request().postDataJSON();
            submissions.push(payload);
            if (hold) await hold;
            if (fail) return route.fulfill({ status: 500, json: { detail: "QA note failure" } });
            body = { id: submissions.length, ...payload };
        }
        await route.fulfill({ json: body });
    });
    await page.goto("/dashboard");
    await page.getByRole("button", { name: task.title, exact: true }).click();
    await page.getByRole("button", { name: /enviar nota/i }).click();
    const dialog = page.getByRole("dialog", { name: "Comentarios del Servicio", exact: true });
    await expect(dialog).toBeVisible();
    return { dialog, submissions, fail: (value: boolean) => { fail = value; },
        hold: () => { hold = new Promise<void>(resolve => { release = resolve; }); },
        release: () => { release?.(); hold = undefined; },
    };
}

for (const width of [1440, 768, 390]) {
    test(`saved comment closes without discarding at ${width}px`, async ({ context, page }) => {
        test.skip(process.env.E2E_BASE_URL !== "http://localhost:3000", "Local UI regression only");
        const state = await openComments(context, page, width);
        await state.dialog.getByRole("textbox").fill("  QA nota guardada  ");
        await state.dialog.getByRole("button", { name: "Comentar", exact: true }).press("Enter");
        await expect(page.getByText("Comentario añadido", { exact: true })).toBeVisible();
        expect(state.submissions).toHaveLength(1);
        expect(state.submissions[0]).toMatchObject({ task_item_id: 1, report_type: "note", description: "QA nota guardada" });
        await expect(state.dialog.getByRole("textbox")).toHaveValue("");
        await state.dialog.getByRole("button", { name: "Close", exact: true }).click();
        await expect(page.getByRole("alertdialog")).toHaveCount(0);
        await expect(state.dialog).toHaveCount(0);
    });
    test(`failed comment keeps its draft and discards cleanly at ${width}px`, async ({ context, page }) => {
        test.skip(process.env.E2E_BASE_URL !== "http://localhost:3000", "Local UI regression only");
        const state = await openComments(context, page, width);
        state.fail(true);
        await state.dialog.getByRole("textbox").fill("QA borrador conservado");
        await state.dialog.getByRole("button", { name: "Comentar", exact: true }).press("Enter");
        await expect(page.getByText("Error al añadir el comentario", { exact: true })).toBeVisible();
        await expect(state.dialog.getByRole("textbox")).toHaveValue("QA borrador conservado");
        await state.dialog.getByRole("button", { name: "Close", exact: true }).click();
        await expect(page.getByRole("alertdialog")).toBeVisible();
        await page.getByRole("button", { name: "Seguir editando", exact: true }).click();
        await expect(state.dialog.getByRole("textbox")).toHaveValue("QA borrador conservado");
        await state.dialog.getByRole("button", { name: "Close", exact: true }).click();
        await page.getByRole("button", { name: "Salir sin guardar", exact: true }).click();
        await page.getByRole("button", { name: /enviar nota/i }).click();
        await expect(state.dialog.getByRole("textbox")).toHaveValue("");
        expect(state.submissions).toHaveLength(1);
    });
}

test("pending comment blocks repeated submits and edits, then permits retry", async ({ context, page }) => {
    test.skip(process.env.E2E_BASE_URL !== "http://localhost:3000", "Local UI regression only");
    const state = await openComments(context, page, 390);
    await expect(state.dialog.getByRole("button", { name: "Comentar", exact: true })).toBeDisabled();
    await state.dialog.getByRole("textbox").fill("   ");
    await state.dialog.locator("form").dispatchEvent("submit");
    expect(state.submissions).toHaveLength(0);
    await expect(state.dialog.getByRole("button", { name: "Comentar", exact: true })).toBeDisabled();
    state.hold(); state.fail(true);
    await state.dialog.getByRole("textbox").fill("QA envío único");
    await state.dialog.getByRole("button", { name: "Comentar", exact: true }).press("Enter");
    try {
        await expect.poll(() => state.submissions.length).toBe(1);
        await expect(state.dialog.getByRole("button", { name: "Comentar", exact: true })).toBeDisabled();
        await expect(state.dialog.getByRole("textbox")).toBeDisabled();
        await state.dialog.locator("form").dispatchEvent("submit");
        expect(state.submissions).toHaveLength(1);
        await state.dialog.press("Escape");
        await expect(state.dialog).toBeVisible();
        await expect(page.getByRole("alertdialog")).toHaveCount(0);
    } finally { state.release(); }
    await expect(page.getByText("Error al añadir el comentario", { exact: true })).toBeVisible();
    await expect(state.dialog.getByRole("textbox")).toHaveValue("QA envío único");
    state.fail(false);
    await state.dialog.getByRole("button", { name: "Comentar", exact: true }).press("Enter");
    await expect(page.getByText("Comentario añadido", { exact: true })).toBeVisible();
    expect(state.submissions).toHaveLength(2);
});
