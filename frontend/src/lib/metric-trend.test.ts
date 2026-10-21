import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { getMonthKey, getPercentageChange, getPreviousMonthKey, getTrendBadgePresentation } from "./metric-trend.ts";

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

test("trend badges keep the real change sign while coloring lower-is-better metrics", () => {
    assert.deepEqual(getTrendBadgePresentation(66.666, "lower"), { value: 66.7, tone: "negative" });
    assert.deepEqual(getTrendBadgePresentation(-100, "lower"), { value: -100, tone: "positive" });
    assert.deepEqual(getTrendBadgePresentation(25, "higher"), { value: 25, tone: "positive" });
    assert.deepEqual(getTrendBadgePresentation(0, "higher"), { value: 0, tone: "neutral" });

    const card = readFileSync(new URL("../components/ui/summary-metric-card.tsx", import.meta.url), "utf8");
    assert.match(card, /getTrendBadgePresentation\(trend\.value, comparisonDirection\)/);
});
