import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function source(path: string): string {
    return readFileSync(new URL(path, import.meta.url), "utf8");
}

test("traffic dashboard uses billing surfaces without accent pad or green chrome", () => {
    const page = source("../app/dashboard/traffic/page.tsx");
    const analytics = source("../components/traffic/TrafficAnalyticsPanel.tsx");
    const stats = source("../components/traffic/TrafficStatsCards.tsx");
    const events = source("../components/traffic/TrafficEventsTable.tsx");
    const map = source("../components/dashboard/TrafficAccessMap.tsx");
    const es = source("../dictionaries/es.json");
    const en = source("../dictionaries/en.json");

    assert.match(page, /billing-surface/);
    assert.match(page, /PageHeader/);
    assert.match(page, /isPlatformSuperadmin/);
    assert.match(page, /TrafficAnalyticsPanel/);
    assert.match(page, /TrafficEventsTable/);
    assert.match(page, /getAuthenticatedTrafficMapPoints\(loginEvents/);
    assert.match(page, /const labels = \[traffic\.desktop, traffic\.mobile, traffic\.tablet, traffic\.browser\]/);
    assert.match(analytics, /dynamic\(/);
    assert.match(analytics, /import\("@\/components\/dashboard\/TrafficAccessMap"\)/);
    assert.doesNotMatch(analytics, /import \{ TrafficAccessMap \}/);
    assert.doesNotMatch(page, /billing-surface-accent-pad/);
    assert.doesNotMatch(page, /surface-glass-card/);
    assert.doesNotMatch(page, /btn-cancel-muted/);
    assert.doesNotMatch(page, /emerald|color-green|text-green-|bg-green-/);

    assert.match(stats, /billing-block/);
    assert.match(stats, /rounded-\[18px\]/);
    assert.doesNotMatch(stats, /emerald|color-green|text-green-|bg-green-/);

    assert.match(analytics, /TrafficStatsCards/);
    assert.match(analytics, /billing-block/);
    assert.match(analytics, /reach_period/);
    assert.doesNotMatch(analytics, /from "@\/components\/ui\/button"/);
    assert.doesNotMatch(analytics, /from "@\/components\/ui\/input"/);
    assert.doesNotMatch(analytics, /billing-surface-accent-pad/);
    assert.doesNotMatch(analytics, /emerald|color-green|text-green-|bg-green-/);

    assert.match(events, /billing-block/);
    assert.match(events, /DataListTable/);
    assert.match(events, /variant="plain"/);
    assert.match(events, /PremiumTabs/);
    assert.match(events, /getDeviceKind/);
    assert.match(events, /Smartphone/);
    assert.match(events, /Tablet/);
    assert.match(events, /Monitor/);
    assert.match(events, /from "@\/components\/ui\/badge"/);
    assert.match(events, /from "@\/components\/ui\/button"/);
    assert.doesNotMatch(events, /<table className/);
    assert.doesNotMatch(events, /btn-cancel-muted/);
    assert.doesNotMatch(events, /emerald|color-green|text-green-|bg-green-/);

    assert.match(map, /billing-block/);
    assert.doesNotMatch(map, /emerald|color-green|text-green-|bg-green-/);

    assert.match(es, /"traffic"/);
    assert.match(en, /"traffic"/);
    assert.match(es, /Alcance/);
    assert.match(en, /Reach/);
});
