import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function source(path: string): string {
    return readFileSync(new URL(path, import.meta.url), "utf8");
}

test("locations page uses billing surfaces and a compact filter chip", () => {
    const page = source("../app/dashboard/locations/page.tsx");
    const card = source("../components/locations/LocationCard.tsx");
    const grid = source("../components/locations/LocationsGrid.tsx");

    assert.match(page, /billing-surface/);
    assert.match(page, /PageHeader/);
    assert.match(page, /PremiumTabs/);
    assert.match(page, /CreateLocationSheet/);
    assert.match(page, /DeleteConfirmDialog/);
    assert.match(page, /billing-block inline-flex/);
    assert.match(page, /w-auto min-w-\[11rem\]/);
    assert.doesNotMatch(page, /billing-surface-accent-pad/);
    assert.doesNotMatch(page, /rounded-full bg-accent/);
    assert.doesNotMatch(page, /absolute left-4 right-4 top-3 h-1\.5/);
    assert.doesNotMatch(page, /rounded-3xl shadow-sm mb-6/);
    assert.doesNotMatch(page, /btn-cancel-muted/);
    assert.doesNotMatch(page, /surface-glass-card/);

    assert.match(card, /billing-block/);
    assert.match(card, /variant="secondary"/);
    assert.doesNotMatch(card, /emerald|color-green|text-green-|bg-green-/);

    assert.match(grid, /billing-block/);
});

test("location services can be unlinked with an explicit confirmation without deleting the catalog template", () => {
    const tab = source("../components/locations/LocationTemplatesTab.tsx");

    assert.match(tab, /DeleteConfirmDialog/);
    assert.match(tab, /unlink_confirm_description/);
    assert.match(tab, /handleUnlinkTemplate: \(templateTaskId: number\) => Promise<boolean>/);
    assert.match(tab, /if \(wasUnlinked\) setTemplateToUnlink\(null\)/);
    assert.match(tab, /unlink_tooltip/);
});
