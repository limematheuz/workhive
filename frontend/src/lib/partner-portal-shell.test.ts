import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");

test("partner portal is isolated from the internal dashboard navigation", () => {
    const layout = source("../app/dashboard/layout.tsx");
    const sidebar = source("../components/dashboard/sidebar-nav-config.tsx");
    const workspace = source("../components/partner-portal/PartnerPortalWorkspace.tsx");

    assert.match(layout, /isPartnerPortal/);
    assert.match(layout, /canAccessPartnerPortalDashboardPath/);
    assert.match(sidebar, /flags\.isPartnerPortal/);
    assert.match(sidebar, /"\/dashboard\/partner\/requests"/);
    assert.match(workspace, /PartnerPortalService\.createReservation/);
    assert.match(workspace, /PremiumTabs/);
});
