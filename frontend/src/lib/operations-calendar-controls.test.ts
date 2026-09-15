import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(new URL("../components/dashboard/OperationsCalendar.tsx", import.meta.url), "utf8");

test("operations calendar uses shared controls and semantic warning colors", () => {
    assert.match(source, /from "@\/components\/ui\/input"/);
    assert.match(source, /from "@\/components\/ui\/select"/);
    assert.match(source, /<Input/);
    assert.match(source, /<SelectTrigger/);
    assert.match(source, /--alert-warning-text/);
    assert.match(source, /--alert-warning-bg/);
    assert.doesNotMatch(source, /<(?:input|select)\b/);
    assert.doesNotMatch(source, /(?:text|bg|border)-orange-/);
});
