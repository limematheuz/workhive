import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { getExpenseComparisonRange } from "./expense-period.ts";

test("expense month queries cover the selected and previous month across year boundaries", () => {
    assert.deepEqual(getExpenseComparisonRange("2026-01"), {
        dateFrom: "2025-11-30T00:00:00.000Z",
        dateTo: "2026-02-02T00:00:00.000Z",
    });
    assert.throws(() => getExpenseComparisonRange("2026-13"));
});

test("the expense page paginates the month comparison instead of truncating at 250", () => {
    const page = readFileSync(new URL("../app/dashboard/expenses/page.tsx", import.meta.url), "utf8");
    const service = readFileSync(new URL("../services/expense.service.ts", import.meta.url), "utf8");

    assert.match(page, /ExpenseService\.getAllExpenses\(getExpenseComparisonRange\(month\)\)/);
    assert.doesNotMatch(page, /getExpenses\(\{ limit: 250 \}\)/);
    assert.match(service, /ExpenseService\.getExpenses\(\{ \.\.\.filters, skip, limit \}\)/);
});
