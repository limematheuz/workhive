import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function source(path: string): string {
    return readFileSync(new URL(path, import.meta.url), "utf8");
}

test("roles admin uses DataListTable billing shell without green status badges", () => {
    const page = source("../app/dashboard/roles/page.tsx");
    const list = source("../components/roles/RolesListSection.tsx");

    assert.match(page, /isPlatformSuperadmin\(user\)/);
    assert.match(page, /PageHeader/);
    assert.match(page, /RolesListSection/);
    assert.match(page, /RoleFormDialogs/);
    assert.doesNotMatch(page, /from "@\/components\/ui\/table"/);
    assert.doesNotMatch(page, /surface-glass-card/);
    assert.doesNotMatch(page, /emerald|color-green|text-green-|bg-green-/);
    assert.doesNotMatch(page, /btn-cancel-muted/);

    assert.match(list, /DataListTable/);
    assert.match(list, /ActionPopover/);
    assert.match(list, /billing-block|DataListTable/);
    assert.match(list, /border-accent\/25 bg-accent\/10/);
    assert.doesNotMatch(list, /from "@\/components\/ui\/table"/);
    assert.doesNotMatch(list, /emerald|color-green|text-green-|bg-green-/);
    assert.doesNotMatch(list, /surface-glass-card/);
});
