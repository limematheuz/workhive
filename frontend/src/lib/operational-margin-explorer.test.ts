import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const explorer = readFileSync(
    new URL("../components/analytics/OperationalMarginExplorer.tsx", import.meta.url),
    "utf8",
);
const analyticsPage = readFileSync(
    new URL("../app/dashboard/analytics/page.tsx", import.meta.url),
    "utf8",
);

test("operational margin reuses the protected scope forecast and only accepts a selected scope", () => {
    assert.match(explorer, /MarginForecastPanel/);
    assert.match(explorer, /scopeType=\{scopeType\}/);
    assert.match(explorer, /scopeId=\{resolvedScopeId\}/);
    assert.match(explorer, /ServiceContract/);
    assert.match(explorer, /WorkOrder/);
    assert.doesNotMatch(explorer, /apiFetch\(/);
});

test("analytics only offers operational margin to users allowed to view labour costs", () => {
    assert.match(analyticsPage, /canViewFinance\(user\) && canViewLaborCosts\(user\)/);
    assert.match(analyticsPage, /id: "operational_margin" as const/);
    assert.match(analyticsPage, /<OperationalMarginExplorer/);
    assert.match(analyticsPage, /ServiceContractService\.getContracts/);
    assert.match(analyticsPage, /WorkOrderService\.getWorkOrders/);
});
