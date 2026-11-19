import { expect, test } from "@playwright/test";
import { base, fixture } from "./fixtures/record-workspace";

test.beforeEach(() => test.skip(!/^http:\/\/(?:localhost|127\.0\.0\.1):(?:3000|3013)$/.test(base), "Local intercepted workspace checks only"));

const result = (query: string, company = 1) => ({ query, company_id: company, context_key: "qa", available_types: ["clients"], navigation: [], groups: [{ type: "clients", label: "Clientes", has_more: false, items: [{ key: "clients:9901", type: "clients", id: 9901, title: query + " · resultado autorizado", context: "Cliente de la empresa activa", status: "active", reference: "CL-9901", href: "/dashboard/clients?clientId=9901" }] }] });

test("global search ignores older responses, filters unsafe destinations and recovers a failed read", async ({ context, page }) => {
    await fixture(context, page);
    const pageErrors: string[] = []; page.on("pageerror", error => pageErrors.push(error.message));
    let release!: () => void, started = false, fail = false;
    const held = new Promise<void>(resolve => { release = resolve; });
    await page.route("**/api/v1/workspace-search?**", async route => {
        const query = new URL(route.request().url()).searchParams.get("q")!;
        if (query === "Anterior") { started = true; await held; }
        if (route.request().failure()) return;
        if (fail) { await route.fulfill({ status: 503, json: { detail: "Búsqueda temporalmente no disponible." } }); return; }
        const data = result(query);
        data.groups[0].items.push({ ...data.groups[0].items[0], key: "unsafe", title: "Destino externo", href: "https://example.invalid/" });
        await route.fulfill({ json: data });
    });
    try {
        await page.goto("/dashboard/quality");
        await page.getByRole("button", { name: "Buscar en la empresa", exact: true }).click();
        const dialog = page.getByRole("dialog"), input = dialog.getByLabel("Nombre, dirección o referencia");
        await input.fill("Anterior"); await expect.poll(() => started).toBe(true);
        await input.fill("Actual");
        await expect(dialog.getByRole("link", { name: /Actual · resultado autorizado/ })).toBeVisible();
        release();
        await expect(dialog.getByRole("link", { name: /Anterior · resultado autorizado/ })).toHaveCount(0);
        await expect(dialog.getByRole("link", { name: /Destino externo/ })).toHaveCount(0);
        fail = true; await input.fill("Recuperar");
        await expect(dialog.getByRole("alert")).toContainText("No se pudo realizar la búsqueda.");
        await expect(input).toHaveValue("Recuperar");
        fail = false; await dialog.getByRole("button", { name: "Volver a intentar", exact: true }).click();
        await expect(dialog.getByRole("link", { name: /Recuperar · resultado autorizado/ })).toBeVisible();
        await input.press("ArrowDown");
        await expect(dialog.getByRole("link", { name: /Recuperar · resultado autorizado/ })).toBeFocused();
        expect(pageErrors).toEqual([]);
    } finally { release(); }
});

test("mobile search waits for two characters and never shows a different company response", async ({ context, page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await fixture(context, page);
    const reads: string[] = [];
    await page.route("**/api/v1/workspace-search?**", async route => {
        const query = new URL(route.request().url()).searchParams.get("q")!; reads.push(query);
        await route.fulfill({ json: result(query, 2) });
    });
    await page.goto("/dashboard/quality");
    await page.getByRole("button", { name: "Buscar en la empresa", exact: true }).click();
    const dialog = page.getByRole("dialog"), input = dialog.getByLabel("Nombre, dirección o referencia");
    await input.fill("M");
    await expect(dialog.getByRole("status")).toContainText("al menos 2 caracteres");
    expect(reads).toEqual([]);
    await input.fill("Marina");
    await expect(dialog.getByRole("alert")).toContainText("La empresa activa ha cambiado");
    await expect(dialog.getByRole("link")).toHaveCount(0);
    await expect(input).toHaveValue("Marina");
    const bounds = await dialog.boundingBox();
    expect(bounds!.x).toBeGreaterThanOrEqual(0); expect(bounds!.width).toBeLessThanOrEqual(390);
});

test("search clears results and checks again when the same user's access flags change", async ({ context, page }) => {
    const state = await fixture(context, page);
    let reads = 0, release!: () => void;
    const held = new Promise<void>(resolve => { release = resolve; });
    await page.route("**/api/v1/workspace-search?**", async route => {
        const read = ++reads;
        if (read > 1) await held;
        if (route.request().failure()) return;
        await route.fulfill({ json: result(read === 1 ? "Acceso anterior" : "Acceso actualizado") });
    });
    try {
        await page.goto("/dashboard/quality");
        await page.getByRole("button", { name: "Buscar en la empresa", exact: true }).click();
        const dialog = page.getByRole("dialog");
        await dialog.getByLabel("Nombre, dirección o referencia").fill("Marina");
        await expect(dialog.getByRole("link", { name: /Acceso anterior/ })).toBeVisible();
        state.permissions["time.manage"] = false;
        await page.evaluate(() => {
            const user = JSON.parse(sessionStorage.getItem("workhive_user_cache:v1")!);
            user.can_manage_time = false;
            sessionStorage.setItem("workhive_user_cache:v1", JSON.stringify(user));
            window.dispatchEvent(new PageTransitionEvent("pageshow", { persisted: true }));
        });
        await expect(dialog.getByRole("link", { name: /Acceso anterior/ })).toHaveCount(0);
        await expect.poll(() => reads).toBeGreaterThan(1);
        release();
        await expect(dialog.getByRole("link", { name: /Acceso actualizado/ })).toBeVisible();
    } finally { release(); }
});

test("logout explains an active clock and preserves the session when the server rejects logout", async ({ context, page }) => {
    const state = await fixture(context, page);
    state.overrides.set("/api/v1/work-sessions/active", () => ({ id: 9911, start_time: "2026-11-19T08:00:00Z", end_time: null }));
    let writes = 0;
    await page.route("**/api/v1/auth/logout", async route => { writes++; await route.fulfill({ status: 503, json: { detail: "No disponible" } }); });
    await page.goto("/dashboard/quality");
    await page.getByRole("button", { name: "Cuenta y perfil", exact: true }).click();
    await page.getByRole("menuitem", { name: "Cerrar sesión", exact: true }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toContainText("Tienes un fichaje en curso");
    await expect(dialog).toContainText("seguirá abierto"); expect(writes).toBe(0);
    await dialog.getByRole("button", { name: "Cerrar sesión", exact: true }).click();
    await expect(dialog.getByRole("alert")).toContainText("No se pudo cerrar la sesión");
    expect(writes).toBe(1);
    await dialog.getByRole("button", { name: "Seguir en WorkHive", exact: true }).click();
    await expect(page.getByRole("button", { name: "Cuenta y perfil", exact: true })).toBeVisible();
    await expect(page).toHaveURL(/\/dashboard\/quality$/);
});
