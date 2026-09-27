import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function source(path: string): string {
    return readFileSync(new URL(path, import.meta.url), "utf8");
}

test("platform calendar overview uses billing surfaces and DataListTable", () => {
    const page = source("../app/dashboard/integrations/page.tsx");
    const overview = source("../components/integrations/PlatformCalendarOverview.tsx");
    const statusCard = source("../components/integrations/PlatformCalendarStatusCard.tsx");
    const calendarUi = `${overview}\n${statusCard}`;

    assert.match(page, /isPlatformSuperadmin\(user\)/);
    assert.match(page, /PlatformCalendarOverview/);
    assert.match(page, /CalendarService\.getPlatformStatus\(\)/);

    assert.match(calendarUi, /billing-surface/);
    assert.match(calendarUi, /billing-block/);
    assert.match(calendarUi, /DataListTable/);
    assert.match(overview, /PageHeader/);
    assert.match(statusCard, /from "@\/components\/ui\/switch"/);
    assert.match(statusCard, /<Switch/);
    assert.doesNotMatch(statusCard, /<input\b/);
    assert.match(calendarUi, /<Button/);
    assert.match(calendarUi, /<Badge/);
    assert.doesNotMatch(statusCard, /<StatusBadge\s+\{\.\.\.item\}\s*\/>/);
    assert.match(overview, /onCopyCallback/);
    assert.match(overview, /onRefresh/);
    assert.match(overview, /onToggle/);
    assert.doesNotMatch(calendarUi, /surface-glass-card/);
    assert.doesNotMatch(calendarUi, /billing-surface-accent-pad/);
    assert.doesNotMatch(calendarUi, /emerald|color-green|text-green-|bg-green-/);
    assert.doesNotMatch(calendarUi, /btn-cancel-muted/);
    assert.doesNotMatch(`${page}\n${calendarUi}`, /client_secret|encryption_key|access_token/i);
});
