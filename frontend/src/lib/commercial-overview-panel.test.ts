import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");

test("commercial overview separates contractual MRR from collected revenue", () => {
    const service = source("../services/company-plan-access.service.ts");
    const panel = source("../components/dashboard/superadmin/CommercialOverviewPanel.tsx");
    const dashboard = source("../components/dashboard/superadmin/SuperadminDashboard.tsx");

    assert.match(service, /commercial-overview/);
    assert.match(panel, /SummaryMetricGrid/);
    assert.match(panel, /revenue_measurement_available/);
    assert.match(panel, /contracted_mrr_cents/);
    assert.match(panel, /active_subscriptions_without_commercial_terms/);
    assert.match(panel, /TableHeader/);
    assert.match(dashboard, /CompanyPlanAccessService\.getCommercialOverview/);
    assert.match(dashboard, /CommercialOverviewPanel/);
    assert.doesNotMatch(panel, /bg-green-|text-green-|emerald/);
});
