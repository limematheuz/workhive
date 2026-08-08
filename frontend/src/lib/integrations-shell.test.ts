import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function source(path: string): string {
    return readFileSync(new URL(path, import.meta.url), "utf8");
}

test("platform calendar overview uses billing surfaces and DataListTable", () => {
    const page = source("../app/dashboard/integrations/page.tsx");
    const overview = source("../components/integrations/PlatformCalendarOverview.tsx");

    assert.match(page, /isPlatformSuperadmin\(user\)/);
    assert.match(page, /PlatformCalendarOverview/);
    assert.match(page, /CalendarService\.getPlatformStatus\(\)/);

    assert.match(overview, /billing-surface/);
    assert.match(overview, /billing-block/);
    assert.match(overview, /DataListTable/);
    assert.match(overview, /PageHeader/);
    assert.match(overview, /role="switch"/);
    assert.match(overview, /<Button/);
    assert.match(overview, /<Badge/);
    assert.match(overview, /onCopyCallback/);
    assert.match(overview, /onRefresh/);
    assert.match(overview, /onToggle/);
    assert.doesNotMatch(overview, /surface-glass-card/);
    assert.doesNotMatch(overview, /billing-surface-accent-pad/);
    assert.doesNotMatch(overview, /emerald|color-green|text-green-|bg-green-/);
    assert.doesNotMatch(overview, /btn-cancel-muted/);
    assert.doesNotMatch(`${page}\n${overview}`, /client_secret|encryption_key|access_token/i);
});
