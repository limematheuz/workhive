import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");

test("location grid prefers two compact cards per row without dropping content", () => {
    const grid = read("../components/locations/LocationsGrid.tsx");
    const card = read("../components/locations/LocationCard.tsx");
    const detail = read("../components/locations/LocationDetailDialog.tsx");
    const globals = read("../app/globals.css");
    const dialog = read("../components/ui/dialog.tsx");

    assert.match(grid, /grid-cols-2/);
    assert.match(grid, /lg:grid-cols-3|xl:grid-cols-4/);
    assert.match(grid, /--brand-blue-sky|--brand-blue-mist|--brand-blue-sky-deep|--brand-blue-bright/);
    assert.match(grid, /var\(--brand-blue\)/);
    assert.doesNotMatch(grid, /#1e3a8a|#1e40af|#14b8a6|#2563eb/);
    assert.match(grid, /billing-block/);
    assert.match(card, /billing-block/);
    assert.match(card, /h-28|h-32/);
    assert.doesNotMatch(card, /max-w-\[300px\]/);
    assert.doesNotMatch(card, /surface-glass-card/);
    assert.match(card, /pendingTasksCount|completedTasksCount/);
    assert.match(card, /ListChecks/);
    assert.match(card, /from "@\/components\/ui\/badge"/);
    assert.match(card, /from "@\/components\/ui\/button"/);
    assert.match(detail, /dialog-glass/);
    assert.match(detail, /dialog-glass-overlay|glass-panel/);
    assert.match(globals, /\[data-slot="dialog-close"\]/);
    assert.match(globals, /\.dialog-glass/);
    assert.match(globals, /\.billing-block/);
    assert.match(dialog, /data-slot="dialog-close"/);
});

test("location cards and detail dialog reject success-green status chrome", () => {
    const card = read("../components/locations/LocationCard.tsx");
    const detail = read("../components/locations/LocationDetailDialog.tsx");
    const page = read("../app/dashboard/locations/page.tsx");

    for (const source of [card, detail, page]) {
        assert.doesNotMatch(source, /emerald/);
        assert.doesNotMatch(source, /color-green/);
        assert.doesNotMatch(source, /text-green-/);
        assert.doesNotMatch(source, /bg-green-/);
    }

    assert.match(card, /bg-accent\/90/);
    assert.match(card, /text-accent/);
    assert.match(card, /bg-accent\/10/);
    assert.match(detail, /bg-accent\/90/);
    assert.match(page, /billing-surface/);
    assert.match(page, /billing-block/);
    assert.match(page, /inline-flex/);
    assert.match(page, /PremiumTabs/);
    assert.doesNotMatch(page, /billing-surface-accent-pad/);
    assert.doesNotMatch(page, /rounded-full bg-accent/);
    assert.doesNotMatch(page, /absolute left-4 right-4 top-3 h-1\.5/);
});
