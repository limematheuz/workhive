import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function source(path: string): string {
    return readFileSync(new URL(path, import.meta.url), "utf8");
}

test("companies admin uses DataListTable billing shell and denser trial requests", () => {
    const page = source("../app/dashboard/companies/page.tsx");
    const list = source("../components/companies/CompaniesListSection.tsx");
    const requests = source("../components/companies/TrialRequestsPanel.tsx");
    const members = source("../components/companies/CompanyMembersPanel.tsx");
    const utils = source("../components/companies/company-utils.ts");

    assert.match(page, /isPlatformSuperadmin\(user\)/);
    assert.match(page, /PageHeader/);
    assert.match(page, /TrialRequestsPanel/);
    assert.match(page, /CompaniesListSection/);
    assert.match(page, /dict\.companies\.new_company/);
    assert.doesNotMatch(page, /btn-cancel-muted/);
    assert.doesNotMatch(page, /surface-glass-card/);

    assert.match(list, /DataListTable/);
    assert.match(list, /ActionPopover/);
    assert.match(list, /onToggleMembers/);
    assert.match(list, /CompanyMembersPanel/);
    assert.match(list, /col-span-full/);
    assert.doesNotMatch(list, /from "@\/components\/ui\/table"/);
    assert.doesNotMatch(list, /surface-glass-card/);
    assert.doesNotMatch(list, /emerald|color-green|text-green-|bg-green-/);

    assert.match(requests, /billing-surface/);
    assert.match(requests, /billing-block/);
    assert.match(requests, /isPlatformSuperadmin\(user\)/);
    assert.match(requests, /py-6/);
    assert.doesNotMatch(requests, /surface-glass-card/);
    assert.doesNotMatch(requests, /emerald|color-green|text-green-|bg-green-/);
    assert.doesNotMatch(requests, /btn-cancel-muted/);

    assert.match(members, /billing-block/);
    assert.doesNotMatch(members, /glass-panel/);

    assert.doesNotMatch(utils, /emerald|color-green|text-green-|bg-green-/);
    assert.match(utils, /border-accent\/25 bg-accent\/10 text-accent/);
});
