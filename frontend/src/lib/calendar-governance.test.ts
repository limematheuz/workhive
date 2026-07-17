import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";


function source(path: string): string {
    return readFileSync(new URL(path, import.meta.url), "utf8");
}


test("platform calendar panel is superadmin-scoped and never reads secrets", () => {
    const page = source("../app/dashboard/integrations/page.tsx");
    const overview = source("../components/integrations/PlatformCalendarOverview.tsx");
    const service = source("../services/calendar.service.ts");
    const iconWell = source("../components/ui/brand-icon-well.tsx");
    const globals = source("../app/globals.css");

    assert.match(page, /isPlatformSuperadmin\(user\)/);
    assert.match(page, /CalendarService\.getPlatformStatus\(\)/);
    assert.match(service, /\/api\/v1\/calendar\/platform\/status/);
    assert.match(overview, /surface-glass-card/);
    assert.match(overview, /BrandIconWell/);
    assert.match(overview, /rounded-full/);
    assert.match(overview, /border-\[var\(--border-soft\)\]/);
    assert.match(iconWell, /icon-well/);
    assert.match(globals, /\.icon-well\s*\{/);
    assert.match(globals, /border-radius:\s*6px/);
    assert.doesNotMatch(overview, /emerald-|amber-/);
    assert.match(overview, /<Button/);
    assert.match(overview, /<Badge/);
    assert.match(overview, /role="switch"/);
    assert.doesNotMatch(`${page}\n${overview}`, /client_secret|encryption_key|access_token/i);
    assert.doesNotMatch(service, /client_secret|encryption_key|access_token/i);
});


test("company calendar renders backend capabilities and ownership workflow", () => {
    const service = source("../services/calendar.service.ts");
    const controls = source("../components/calendar/CalendarGoogleControls.tsx");
    const requests = source("../components/calendar/CalendarOwnershipRequests.tsx");
    const calendar = source("../components/calendar/CompanyCalendar.tsx");

    assert.match(service, /can_connect: boolean/);
    assert.match(service, /can_request_ownership: boolean/);
    assert.match(service, /\/ownership-requests\/\$\{requestId\}\/\$\{decision\}/);
    assert.match(controls, /status\.can_connect/);
    assert.match(controls, /status\.can_disconnect/);
    assert.match(controls, /status\.can_request_ownership/);
    assert.match(requests, /decision: "approve" \| "reject"/);
    assert.match(calendar, /canLoadStatus: canView/);
});


test("only the platform navigation exposes the integrations panel", () => {
    const sidebar = source("../components/dashboard/sidebar-nav-config.tsx");

    assert.match(sidebar, /PLATFORM_SUPERADMIN_HREFS/);
    assert.match(sidebar, /"\/dashboard\/integrations"/);
    assert.match(sidebar, /userIsPlatformSuperadmin/);
});
