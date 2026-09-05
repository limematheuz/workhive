import { expect, test, type Page } from "@playwright/test";

test.setTimeout(60_000);

// Use only with backend/scripts/seed_portal_e2e.py and an isolated E2E_BASE_URL.
async function login(page: Page, email = "portal@e2e.example") {
    await page.goto("/login");
    await page.locator('input[type="email"]').fill(email);
    await page.locator('input[type="password"]').fill("e2e-password");
    await page.locator('button[type="submit"]').click();
    await page.waitForURL(/\/dashboard/, { timeout: 30_000 });
}

async function newProperty(page: Page) {
    await page.goto("/dashboard/partner/properties");
    await page.getByRole("button", { name: "Nueva propiedad", exact: true }).click();
}

test("dirty modal guards X, escape, backdrop, selectors and a clean reopening", async ({ page }) => {
    await login(page);
    await newProperty(page);
    await page.locator("#location-workspace-name").fill("Draft kept");
    const close = () => page.locator('[data-slot="dialog-content"] [data-slot="dialog-close"]').click();
    await close();
    await expect(page.getByRole("alertdialog")).toBeVisible();
    await page.getByRole("button", { name: "Seguir editando" }).click();
    await expect(page.locator("#location-workspace-name")).toHaveValue("Draft kept");
    await page.keyboard.press("Escape");
    await expect(page.getByRole("alertdialog")).toBeVisible();
    await page.getByRole("button", { name: "Seguir editando" }).click();
    await page.locator('[data-slot="dialog-overlay"]').click({ position: { x: 8, y: 8 } });
    await expect(page.getByRole("alertdialog")).toBeVisible();
    await page.getByRole("button", { name: "Salir sin guardar" }).click();
    await expect(page.locator("#location-workspace-name")).toHaveCount(0);
    await page.getByRole("button", { name: "Nueva propiedad", exact: true }).click();
    await close();
    await expect(page.getByRole("alertdialog")).toHaveCount(0);
    await expect(page.locator("#location-workspace-name")).toHaveCount(0);
    await page.getByRole("button", { name: "Nueva propiedad", exact: true }).click();
    await page.locator("#access-keys-available").click();
    await page.getByRole("option", { name: "Sí", exact: true }).click();
    await close();
    await expect(page.getByRole("alertdialog")).toBeVisible();
    await page.getByRole("button", { name: "Seguir editando" }).click();
    await expect(page.locator("#access-keys-available")).toHaveText("Sí");
});

test("property and cleaning request create/edit/delete round trip without reloads", async ({ page }) => {
    test.setTimeout(90_000);
    await login(page);
    await newProperty(page);
    await page.locator("#location-workspace-name").fill("Portal E2E property");
    await page.locator("#location-workspace-address").fill("Test road 12");
    await page.locator("#location-workspace-city").fill("Girona");
    await page.locator("#location-workspace-postal-code").fill("17001");
    await page.locator("#access-method").fill("Recepción");
    await page.getByRole("button", { name: "Siguiente", exact: true }).click();
    await page.getByRole("button", { name: /Apartamento turístico/ }).click();
    await page.getByRole("button", { name: "Siguiente", exact: true }).click();
    await page.locator("#location-contact-email").fill("reception@e2e.example");
    await page.getByRole("button", { name: "Siguiente", exact: true }).click();
    const created = page.waitForResponse(response => response.url().endsWith("/partner-portal/locations") && response.request().method() === "POST");
    await page.getByRole("button", { name: "Crear y compartir", exact: true }).click();
    expect((await created).status()).toBe(201);
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await page.getByRole("button", { name: "Acciones para Portal E2E property" }).last().click();
    await page.getByRole("menuitem", { name: "Editar", exact: true }).click();
    await expect(page.locator("#access-method")).toHaveValue("Recepción");
    await page.locator("#location-workspace-name").fill("Portal E2E edited");
    for (let step = 0; step < 3; step++) await page.getByRole("button", { name: "Siguiente", exact: true }).click();
    await page.getByRole("button", { name: "Guardar cambios", exact: true }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);

    let navigations = 0;
    page.on("framenavigated", frame => { if (frame === page.mainFrame()) navigations++; });
    await page.getByRole("tab", { name: /Solicitudes/i }).click();
    await page.getByRole("button", { name: "Nueva solicitud", exact: true }).click();
    await page.locator("#partner-location").click();
    await page.getByRole("option", { name: "Portal E2E edited" }).click();
    await page.locator("#partner-check-in").fill("2027-07-01T12:00");
    await page.locator("#partner-check-out").fill("2027-07-04T12:00");
    await page.getByRole("button", { name: "Enviar solicitud", exact: true }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await page.getByRole("button", { name: "Acciones para Portal E2E edited" }).last().click();
    await page.getByRole("menuitem", { name: "Editar", exact: true }).click();
    await expect(page.locator("#partner-location")).toBeDisabled();
    await page.locator("#partner-notes").fill("Updated request");
    await page.getByRole("button", { name: "Guardar cambios", exact: true }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await page.getByRole("button", { name: "Acciones para Portal E2E edited" }).last().click();
    await page.getByRole("menuitem", { name: "Eliminar", exact: true }).click();
    await page.getByRole("dialog").getByRole("button", { name: /Eliminar/ }).click();
    await expect(page.getByText("Aún no hay solicitudes")).toBeVisible();
    await page.getByRole("tab", { name: /Propiedades/i }).click();
    await page.getByRole("button", { name: "Acciones para Portal E2E edited" }).click();
    await page.getByRole("menuitem", { name: "Eliminar", exact: true }).click();
    await page.getByRole("dialog").getByRole("button", { name: /Eliminar/ }).click();
    await expect(page.getByText("Portal E2E edited", { exact: true })).toHaveCount(0);
    expect(navigations).toBe(0);
});

test("external invitation Back preserves its draft and malformed keys cannot crash the sidebar", async ({ page }) => {
    await login(page, "admin@e2e.example");
    const errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.goto("/dashboard/external-network");
    await page.evaluate(() => window.dispatchEvent(new Event("keydown")));
    await page.getByRole("button", { name: "Añadir colaborador", exact: true }).click();
    await page.getByRole("button", { name: /Invitar.*portal/ }).click();
    await page.locator("#sponsored-partner-company").fill("Draft company");
    await page.locator("#sponsored-partner-email").fill("draft@e2e.example");
    await page.getByRole("button", { name: "Volver", exact: true }).click();
    await page.getByRole("button", { name: /Invitar.*portal/ }).click();
    await expect(page.locator("#sponsored-partner-company")).toHaveValue("Draft company");
    await expect(page.locator("#sponsored-partner-email")).toHaveValue("draft@e2e.example");
    expect(errors).toEqual([]);
});
