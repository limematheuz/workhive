import assert from "node:assert/strict";
import test from "node:test";

import { getMonthKey, getPercentageChange, getPreviousMonthKey } from "./metric-trend.ts";

test("metric trends preserve real intermediate percentage changes", () => {
    assert.equal(getPercentageChange(134.5, 100), 34.5);
    assert.equal(getPercentageChange(24, 100), -76);
    assert.equal(getPercentageChange(100, 100), 0);
});

test("metric trends do not invent a percentage when the prior value is zero", () => {
    assert.equal(getPercentageChange(100, 0), null);
    assert.equal(getPercentageChange(0, 0), null);
});

test("metric trends use adjacent calendar months for comparisons", () => {
    assert.equal(getMonthKey("2026-08-24T12:00:00Z"), "2026-08");
    assert.equal(getPreviousMonthKey("2026-01"), "2025-12");
    assert.equal(getPreviousMonthKey("2026-08"), "2026-07");
    assert.equal(getPreviousMonthKey("bad-period"), null);
});
