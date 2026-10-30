import { expect, type Locator, type Page } from "@playwright/test";

export async function selectSection(scope: Page | Locator, page: Page, name: string | RegExp, label = "Seleccionar sección") {
    await scope.locator("[data-tab-navigation]").first().waitFor({ state: "attached" });
    await expect(scope.locator('[data-tabs-ready="false"]')).toHaveCount(0);
    // A resize may swap the picker for tabs between observation and interaction.
    await expect(async () => {
        const tab = scope.getByRole("tab", { name, exact: typeof name === "string" });
        if (await tab.isVisible()) await tab.click({ timeout: 1500 });
        else {
            await scope.getByRole("combobox", { name: label, exact: true }).click({ timeout: 1500 });
            await page.getByRole("option", { name, exact: typeof name === "string" }).click({ timeout: 1500 });
        }
    }).toPass({ timeout: 10_000 });
}
