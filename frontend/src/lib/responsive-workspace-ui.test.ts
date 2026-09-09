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

test("shared shadcn tables keep native table semantics while list views provide cards on mobile", () => {
    const table = read("../components/ui/table.tsx");
    const dataList = read("../components/ui/data-list-table.tsx");

    assert.match(table, /w-full caption-bottom text-sm/);
    assert.match(table, /border-b border-\[var\(--table-divider\)\] transition-colors hover:!bg-muted\/50/);
    assert.match(dataList, /<Card/);
    assert.match(dataList, /lg:hidden|md:hidden/);
});
