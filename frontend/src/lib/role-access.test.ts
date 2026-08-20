import assert from "node:assert/strict";
import test from "node:test";

import {
    canViewFinanceRole,
    isCompanyAdminRole,
    isAccountantRole,
} from "../domain/access/roles.ts";

test("company privacy administration excludes managers and viewers", () => {
    assert.equal(isCompanyAdminRole("admin"), true);
    assert.equal(isCompanyAdminRole("superadmin"), true);
    assert.equal(isCompanyAdminRole("manager"), false);
    assert.equal(isCompanyAdminRole("viewer"), false);
});

test("accountants can read finance without becoming company administrators", () => {
    assert.equal(isAccountantRole("accountant"), true);
    assert.equal(isCompanyAdminRole("accountant"), false);
    assert.equal(canViewFinanceRole("accountant"), true);
    assert.equal(canViewFinanceRole("viewer"), false);
});
