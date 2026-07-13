import assert from "node:assert/strict";
import test from "node:test";

import { isCompanyAdminRole } from "../domain/access/roles.ts";

test("company privacy administration excludes managers and viewers", () => {
    assert.equal(isCompanyAdminRole("admin"), true);
    assert.equal(isCompanyAdminRole("superadmin"), true);
    assert.equal(isCompanyAdminRole("manager"), false);
    assert.equal(isCompanyAdminRole("viewer"), false);
});
