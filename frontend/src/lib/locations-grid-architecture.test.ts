import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");

test("location list uses a dense operational table and keeps the detail free of photos", () => {
    const grid = read("../components/locations/LocationsGrid.tsx");
    const detail = read("../components/locations/LocationDetailDialog.tsx");
    const globals = read("../app/globals.css");
    const dialog = read("../components/ui/dialog.tsx");

    assert.match(grid, /DataListTable/);
    assert.match(grid, /DataListRow|gridClassName/);
    assert.match(grid, /dict\.locations\.title/);
    assert.match(grid, /workspace\.tasks/);
    assert.match(grid, /dict\.locations\.table\.status/);
    assert.doesNotMatch(grid, /LocationCard/);
    assert.doesNotMatch(grid, /#1e3a8a|#1e40af|#14b8a6|#2563eb/);
    assert.match(grid, /ActionPopover/);
    assert.match(grid, /getLocationTypeVisual/);
    assert.match(detail, /dialog-glass/);
    assert.match(detail, /dialog-glass-overlay|glass-panel/);
    assert.doesNotMatch(detail, /photo_url|<Image/);
    assert.match(globals, /\[data-slot="dialog-close"\]/);
    assert.match(globals, /\.dialog-glass/);
    assert.match(globals, /\.billing-block/);
    assert.match(dialog, /data-slot="dialog-close"/);
});

test("location table uses semantic status and shared application surfaces", () => {
    const grid = read("../components/locations/LocationsGrid.tsx");
    const detail = read("../components/locations/LocationDetailDialog.tsx");
    const page = read("../app/dashboard/locations/page.tsx");

    assert.match(grid, /bg-\[var\(--status-active-bg\)\]/);
    assert.match(grid, /text-\[var\(--status-active-text\)\]/);
    assert.match(grid, /bg-accent\/10/);
    assert.match(detail, /bg-accent\/90/);
    assert.match(page, /billing-surface/);
    assert.match(page, /billing-block/);
    assert.match(page, /inline-flex/);
    assert.match(page, /PremiumTabs/);
    assert.doesNotMatch(page, /billing-surface-accent-pad/);
    assert.doesNotMatch(page, /rounded-full bg-accent/);
    assert.doesNotMatch(page, /absolute left-4 right-4 top-3 h-1\.5/);
});
