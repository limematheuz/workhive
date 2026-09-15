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
const teamLaborCostPanel = readFileSync(
    new URL("../components/analytics/TeamLaborCostPanel.tsx", import.meta.url),
    "utf8",
);
const teamLaborCostService = readFileSync(
    new URL("../services/team-labor-cost.service.ts", import.meta.url),
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
    assert.match(explorer, /TeamLaborCostPanel/);
    assert.match(explorer, /value="team"/);
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
    assert.match(analyticsPage, /TeamLaborCostService\.getSummaries/);
    assert.match(locationMarginPanel, /LocationMarginService\.get/);
    assert.match(locationMarginService, /margin-forecasts\/locations/);
    assert.match(serviceMarginPanel, /ServiceMarginService\.get/);
    assert.match(serviceMarginService, /margin-forecasts\/services/);
    assert.match(teamLaborCostPanel, /SummaryMetricCard/);
    assert.match(teamLaborCostService, /margin-forecasts\/teams/);
    assert.doesNotMatch(locationMarginPanel, /apiFetch\(/);
    assert.doesNotMatch(serviceMarginPanel, /apiFetch\(/);
    assert.doesNotMatch(teamLaborCostPanel, /apiFetch\(/);
});

test("margin panels use shared metrics and semantic global colour tokens", () => {
    const locationMarginPanel = readFileSync(
        new URL("../components/analytics/LocationMarginPanel.tsx", import.meta.url),
        "utf8",
    );
    const forecastPanel = readFileSync(
        new URL("../components/margin-forecast/MarginForecastPanel.tsx", import.meta.url),
        "utf8",
    );
    const summaryMetricCard = readFileSync(
        new URL("../components/ui/summary-metric-card.tsx", import.meta.url),
        "utf8",
    );

    for (const source of [locationMarginPanel, serviceMarginPanel, forecastPanel]) {
        assert.match(source, /SummaryMetricCard/);
        assert.doesNotMatch(source, /text-(emerald|red|orange|amber)-/);
    }
    assert.match(summaryMetricCard, /var\(--status-active-text\)/);
    assert.match(summaryMetricCard, /var\(--priority-high-text\)/);
    assert.doesNotMatch(summaryMetricCard, /red-500|red-600/);
});
