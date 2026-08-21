import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";


function source(path: string): string {
    return readFileSync(new URL(path, import.meta.url), "utf8");
}


test("platform calendar panel is superadmin-scoped and never reads secrets", () => {
    const page = source("../app/dashboard/integrations/page.tsx");
    const overview = source("../components/integrations/PlatformCalendarOverview.tsx");
    const statusCard = source("../components/integrations/PlatformCalendarStatusCard.tsx");
    const service = source("../services/calendar.service.ts");

    assert.match(page, /isPlatformSuperadmin\(user\)/);
    assert.match(page, /CalendarService\.getPlatformStatus\(\)/);
    assert.match(service, /\/api\/v1\/calendar\/platform\/status/);
    const calendarUi = `${overview}\n${statusCard}`;
    assert.match(calendarUi, /billing-surface/);
    assert.match(calendarUi, /billing-block/);
    assert.match(calendarUi, /DataListTable/);
    assert.doesNotMatch(calendarUi, /surface-glass-card/);
    assert.doesNotMatch(calendarUi, /BrandIconWell|icon-well/);
    assert.doesNotMatch(calendarUi, /emerald-|amber-/);
    assert.match(calendarUi, /<Button/);
    assert.match(calendarUi, /<Badge/);
    assert.match(calendarUi, /role="switch"/);
    assert.doesNotMatch(`${page}\n${calendarUi}`, /client_secret|encryption_key|access_token/i);
    assert.doesNotMatch(service, /client_secret|encryption_key|access_token/i);
});


test("company calendar renders backend capabilities and ownership workflow", () => {
    const service = source("../services/calendar.service.ts");
    const controls = source("../components/calendar/CalendarGoogleControls.tsx");
    const requests = source("../components/calendar/CalendarOwnershipRequests.tsx");
    const calendar = source("../components/calendar/CompanyCalendar.tsx");
    const header = source("../components/calendar/CalendarHeader.tsx");
    const connection = source("../components/calendar/useGoogleCalendarConnection.ts");

    assert.match(service, /can_connect: boolean/);
    assert.match(service, /can_request_ownership: boolean/);
    assert.match(service, /\/ownership-requests\/\$\{requestId\}\/\$\{decision\}/);
    assert.match(controls, /status\.can_connect/);
    assert.match(controls, /status\.can_disconnect/);
    assert.match(controls, /status\.can_request_ownership/);
    assert.match(requests, /decision: "approve" \| "reject"/);
    assert.match(calendar, /canLoadStatus: canView/);
    assert.match(header, /company_connection_scope/);
    assert.match(header, /google_account_hint/);
    assert.match(connection, /connectionAccessDenied/);
    assert.match(connection, /connectionConfigurationError/);
    assert.match(connection, /reason === "access_denied"/);
});


test("only the platform navigation exposes the integrations panel", () => {
    const sidebar = source("../components/dashboard/sidebar-nav-config.tsx");

    assert.match(sidebar, /PLATFORM_SUPERADMIN_HREFS/);
    assert.match(sidebar, /"\/dashboard\/integrations"/);
    assert.match(sidebar, /userIsPlatformSuperadmin/);
});
