import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");

test("summary metric grids keep two columns on mobile and do not stretch an odd final card", () => {
    const grid = read("../components/ui/summary-metric-card.tsx");
    assert.match(grid, /grid grid-cols-2 gap-3/);
    assert.match(grid, /desktopColumns\?: 3 \| 4 \| 5 \| 6/);
    assert.doesNotMatch(grid, /last:col-span-2/);
});

test("shared shadcn tables remove horizontal scrolling on mobile", () => {
    const table = read("../components/ui/table.tsx");
    assert.match(table, /max-md:overflow-visible/);
    assert.match(table, /max-md:!min-w-0/);
    assert.match(table, /max-md:\[&_thead\]:sr-only/);
    assert.match(table, /max-md:\[&_td\]:flex/);
});
