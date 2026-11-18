import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const layout = readFileSync(
    new URL("../app/dashboard/layout.tsx", import.meta.url),
    "utf8",
);
const account = readFileSync(
    new URL("../components/dashboard/NoWorkspaceAccount.tsx", import.meta.url),
    "utf8",
);

test("a person without a company gets an account-only workspace", () => {
    assert.match(layout, /user\.company_id == null && user\.role\?\.name !== "superadmin"/);
    assert.match(layout, /<NoWorkspaceAccount/);
    assert.match(account, /PrivacyControls/);
    assert.match(account, /@\/components\/ui\/button/);
    assert.doesNotMatch(account, /<button/);
});

test("grant-based customer and adviser accounts reach their isolated portal without an internal company", () => {
    assert.match(layout, /if \(user\.company_id == null && user\.role\?\.name !== "superadmin" && !isClientPortal && !isExternalPortal\)\s*\{\s*return <NoWorkspaceAccount/);
    assert.match(layout, /const isExternalPortal = isExternalPortalRole\(user\?\.role\?\.name\)/);
    assert.match(layout, /if \(isExternalPortal && !canAccessExternalPortalDashboardPath\(pathname\)\)\s*\{\s*redirect\("\/dashboard\/advisory"\)/);
    assert.match(layout, /if \(isClientPortal && !canAccessClientPortalDashboardPath\(pathname\)\)\s*\{\s*redirect\("\/dashboard\/client"\)/);
});

test("partner and internal identities still require their company workspace", () => {
    const guard = layout.match(/if \((user\.company_id == null[^\n]+)\)\s*\{\s*return <NoWorkspaceAccount/);
    assert.ok(guard);
    assert.doesNotMatch(guard[1], /isPartnerPortal|isCompanyAdmin|isAdminOrManager/);
});
