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
const locationMarginPanel = readFileSync(
    new URL("../components/analytics/LocationMarginPanel.tsx", import.meta.url),
    "utf8",
);
const locationMarginService = readFileSync(
    new URL("../services/location-margin.service.ts", import.meta.url),
    "utf8",
);
const serviceMarginPanel = readFileSync(
    new URL("../components/analytics/ServiceMarginPanel.tsx", import.meta.url),
    "utf8",
);
const serviceMarginService = readFileSync(
    new URL("../services/service-margin.service.ts", import.meta.url),
    "utf8",
);

test("operational margin reuses the protected scope forecast and only accepts a selected scope", () => {
    assert.match(explorer, /MarginForecastPanel/);
    assert.match(explorer, /scopeType=\{scopeType\}/);
    assert.match(explorer, /scopeId=\{resolvedScopeId\}/);
    assert.match(explorer, /ServiceContract/);
    assert.match(explorer, /WorkOrder/);
    assert.match(explorer, /LocationMarginPanel/);
    assert.match(explorer, /value="location"/);
    assert.match(explorer, /ServiceMarginPanel/);
    assert.match(explorer, /value="service"/);
    assert.doesNotMatch(explorer, /apiFetch\(/);
});

test("analytics only offers operational margin to users allowed to view labour costs", () => {
    assert.match(analyticsPage, /canViewFinance\(user\) && canViewLaborCosts\(user\)/);
    assert.match(analyticsPage, /id: "operational_margin" as const/);
    assert.match(analyticsPage, /<OperationalMarginExplorer/);
    assert.match(analyticsPage, /ServiceContractService\.getContracts/);
    assert.match(analyticsPage, /WorkOrderService\.getWorkOrders/);
    assert.match(analyticsPage, /LocationService\.getLocations/);
    assert.match(analyticsPage, /ServiceMarginService\.getScopes/);
    assert.match(locationMarginPanel, /LocationMarginService\.get/);
    assert.match(locationMarginService, /margin-forecasts\/locations/);
    assert.match(serviceMarginPanel, /ServiceMarginService\.get/);
    assert.match(serviceMarginService, /margin-forecasts\/services/);
    assert.doesNotMatch(locationMarginPanel, /apiFetch\(/);
    assert.doesNotMatch(serviceMarginPanel, /apiFetch\(/);
});
