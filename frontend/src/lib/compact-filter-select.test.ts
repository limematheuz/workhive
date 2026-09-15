import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function source(path: string): string {
    return readFileSync(new URL(path, import.meta.url), "utf8");
}

test("compact filters reuse the local shadcn Select without changing empty filter values", () => {
    const control = source("../components/ui/compact-filter-select.tsx");

    assert.match(control, /from "@\/components\/ui\/select"/);
    assert.match(control, /EMPTY_FILTER_VALUE/);
    assert.match(control, /nextValue === EMPTY_FILTER_VALUE \? "" : nextValue/);
    assert.match(control, /<SelectTrigger/);
    assert.match(control, /<SelectItem/);
    assert.doesNotMatch(control, /<select\b/);
});
