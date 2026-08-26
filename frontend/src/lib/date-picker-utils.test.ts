import assert from "node:assert/strict";
import test from "node:test";

import {
    formatDateTyping,
    formatSpanishDate,
    parseIsoDate,
    parseTypedDate,
    toIsoDate,
} from "./date-picker-utils.ts";

test("date picker stores local ISO dates without timezone changes", () => {
    assert.equal(toIsoDate(parseIsoDate("2026-08-07")!), "2026-08-07");
    assert.equal(parseIsoDate("2026-02-31"), undefined);
    assert.equal(toIsoDate(parseTypedDate("07082026")!), "2026-08-07");
    assert.equal(toIsoDate(parseTypedDate("07/08/2026")!), "2026-08-07");
    assert.equal(formatDateTyping("07082026"), "07/08/2026");
    assert.equal(formatSpanishDate(parseIsoDate("2026-08-07")), "07/08/2026");
});
