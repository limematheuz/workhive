import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(
    new URL("../components/invoices/InvoicesStatsCards.tsx", import.meta.url),
    "utf8",
);

test("invoice stats cards use a 2x2 grid on mobile", () => {
    assert.match(source, /SummaryMetricGrid desktopColumns=\{4\}/);
    assert.doesNotMatch(source, /grid-cols-1/);
});

test("invoice stats cards use compact semantic icon chips instead of colour-only bars", () => {
    assert.match(source, /FinanceMetricButton/);
    assert.match(source, /FilePenLine/);
    assert.match(source, /OctagonAlert/);
    assert.doesNotMatch(source, /h-1\.5 w-full rounded-full/);
    assert.doesNotMatch(source, /green|emerald/);
});

test("invoice priorities open exact record filters without pretending historical balance trends", () => {
    assert.match(source, /onAttentionChange/);
    assert.match(source, /filter: "draft"/);
    assert.match(source, /filter: "pending"/);
    assert.match(source, /filter: "overdue"/);
    assert.doesNotMatch(source, /getMetricTrend|100%/);
});
