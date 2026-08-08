import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function source(path: string): string {
    return readFileSync(new URL(path, import.meta.url), "utf8");
}

test("superadmin hub uses billing surfaces without accent pad or green chrome", () => {
    const page = source("../app/dashboard/page.tsx");
    const hub = source("../components/dashboard/superadmin/SuperadminDashboard.tsx");
    const stats = source("../components/dashboard/superadmin/SuperadminStatsCards.tsx");
    const nav = source("../components/dashboard/superadmin/SuperadminNavCards.tsx");
    const activity = source("../components/dashboard/superadmin/SuperadminActivityPanels.tsx");
    const es = source("../dictionaries/es.json");
    const en = source("../dictionaries/en.json");

    assert.match(page, /SuperadminDashboard/);
    assert.match(page, /isPlatformSuperadmin/);
    assert.doesNotMatch(page, /Administración de WorkHive/);

    assert.match(hub, /billing-surface/);
    assert.match(hub, /PageHeader/);
    assert.match(hub, /SuperadminStatsCards/);
    assert.match(hub, /SuperadminNavCards/);
    assert.match(hub, /SuperadminActivityPanels/);
    assert.match(hub, /CompanyService\.getCompanies/);
    assert.match(hub, /UserService\.getUsers/);
    assert.match(hub, /RoleService\.getRoles/);
    assert.match(hub, /TrialRequestService\.list/);
    assert.doesNotMatch(hub, /billing-surface-accent-pad/);
    assert.doesNotMatch(hub, /surface-glass-card/);
    assert.doesNotMatch(hub, /bg-\[var\(--bg-card\)\]/);

    assert.match(stats, /billing-block/);
    assert.match(stats, /rounded-\[18px\]/);
    assert.doesNotMatch(stats, /emerald|color-green|text-green-|bg-green-/);

    assert.match(nav, /\/dashboard\/companies/);
    assert.match(nav, /\/dashboard\/users/);
    assert.match(nav, /\/dashboard\/roles/);
    assert.match(nav, /\/dashboard\/traffic/);
    assert.match(nav, /\/dashboard\/integrations/);
    assert.match(nav, /billing-block/);
    assert.doesNotMatch(nav, /emerald|color-green|text-green-|bg-green-/);

    assert.match(activity, /billing-block/);
    assert.match(activity, /text-accent/);
    assert.doesNotMatch(activity, /emerald|color-green|text-green-|bg-green-/);

    assert.match(es, /"superadmin"/);
    assert.match(en, /"superadmin"/);
    assert.match(es, /Administración de WorkHive/);
    assert.match(en, /WorkHive Administration/);
});
