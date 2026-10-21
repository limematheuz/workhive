import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");

test("labour costs remain a separate admin-only workspace", () => {
    const page = source("../app/dashboard/labor-costs/page.tsx");
    const sidebar = source("../components/dashboard/sidebar-nav-config.tsx");

    assert.match(page, /canViewLaborCosts\(user\) && !isPlatformSuperadmin\(user\)/);
    assert.match(page, /canManageLaborCosts\(user\) && !isPlatformSuperadmin\(user\)/);
    assert.match(page, /OrganizationService\.getMembers\(\)/);
    assert.match(sidebar, /flags\.canViewLaborCosts/);
    assert.match(sidebar, /href: "\/dashboard\/labor-costs"/);
});

test("labour costs retain their own title in the global dashboard header", () => {
    const header = source("../components/dashboard/DashboardHeader.tsx");
    assert.match(header, /pathname\.includes\("\/dashboard\/labor-costs"\) \? "Costes laborales"/);
});
