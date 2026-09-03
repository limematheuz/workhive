import assert from "node:assert/strict";
import test from "node:test";

import {
    canViewFinanceRole,
    isCompanyAdminRole,
    isExternalPortalRole,
} from "../domain/access/roles.ts";

test("company privacy administration excludes managers and viewers", () => {
    assert.equal(isCompanyAdminRole("admin"), true);
    assert.equal(isCompanyAdminRole("superadmin"), true);
    assert.equal(isCompanyAdminRole("manager"), false);
    assert.equal(isCompanyAdminRole("viewer"), false);
});

test("external accountants can read finance without becoming company administrators", () => {
    assert.equal(isExternalPortalRole("external_portal"), true);
    assert.equal(isCompanyAdminRole("external_portal"), false);
    assert.equal(canViewFinanceRole("external_portal"), true);
    assert.equal(canViewFinanceRole("viewer"), false);
});
