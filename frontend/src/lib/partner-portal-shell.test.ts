import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");

test("partner portal is isolated from the internal dashboard navigation", () => {
    const layout = source("../app/dashboard/layout.tsx");
    const sidebar = source("../components/dashboard/sidebar-nav-config.tsx");
    const workspace = source("../components/partner-portal/PartnerPortalWorkspace.tsx");
    const notifications = source("../components/dashboard/notifications/NotificationPanel.tsx");
    const api = source("../lib/api.ts");
    const portalService = source("../services/partner-portal.service.ts");

    assert.match(layout, /isPartnerPortal/);
    assert.match(layout, /canAccessPartnerPortalDashboardPath/);
    assert.match(sidebar, /flags\.isPartnerPortal/);
    assert.match(sidebar, /"\/dashboard\/partner\/requests"/);
    assert.match(source("../components/partner-portal/PartnerPortalRequestDialog.tsx"), /PartnerPortalService\.createReservation/);
    assert.match(source("../components/partner-portal/PartnerPortalPropertyDialog.tsx"), /PartnerPortalService\.createLocation/);
    assert.match(source("../components/partner-portal/PartnerPortalPropertyDialog.tsx"), /contacts/);
    assert.match(source("../components/partner-portal/PartnerPortalPropertyDialog.tsx"), /risks/);
    assert.match(source("../components/partner-portal/PartnerPortalPropertyDialog.tsx"), /service_windows/);
    assert.match(workspace, /PremiumTabs/);
    assert.match(workspace, /initialLoadStartedRef/);
    assert.match(workspace, /loadPromiseRef/);
    assert.match(workspace, /<Table className="table-fixed text-left">/);
    assert.doesNotMatch(workspace, /window\.location\.assign/);
    assert.doesNotMatch(workspace, /emerald-/);
    assert.match(notifications, /!isPartnerPortalRole\(user\?\.role\?\.name\)/);
    assert.doesNotMatch(api, /response\.status === 402/);
    assert.match(portalService, /Este acceso solo incluye el portal patrocinado/);
    assert.match(portalService, /Tu acceso al portal ya no está activo/);
    assert.match(portalService, /createLocation/);
    assert.match(portalService, /\/api\/v1\/partner-portal\/locations/);
});

test("partner portal translates access denials without leaking internal backend copy", () => {
    const portalService = source("../services/partner-portal.service.ts");

    assert.match(portalService, /response\.status === 402\) return PORTAL_WORKSPACE_ACCESS_MESSAGE/);
    assert.match(portalService, /response\.status === 403\) return PORTAL_ACCESS_REVOKED_MESSAGE/);
    assert.match(portalService, /throw new ApiResponseError/);
});
