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
    assert.match(grid, /#93c5fd|#60a5fa|#7dd3fc|#bfdbfe/);
    assert.doesNotMatch(grid, /#1e3a8a|#1e40af|#14b8a6/);
    assert.match(card, /surface-glass-card/);
    assert.match(card, /h-32|h-36/);
    assert.doesNotMatch(card, /max-w-\[300px\]/);
    assert.match(card, /pendingTasksCount|completedTasksCount/);
    assert.match(card, /ListChecks/);
    assert.match(detail, /dialog-glass/);
    assert.match(detail, /dialog-glass-overlay|glass-panel/);
    assert.match(globals, /\[data-slot="dialog-close"\]/);
    assert.match(globals, /\.dialog-glass/);
    assert.match(globals, /\.surface-glass-card/);
    assert.match(dialog, /data-slot="dialog-close"/);
});
