import assert from "node:assert/strict";
import test from "node:test";

import { COMPANY_ASSIGNABLE_ROLE_NAMES } from "../components/users/user-role-utils.ts";

test("company administrators can grant the external accountant portal", () => {
    assert.ok(COMPANY_ASSIGNABLE_ROLE_NAMES.includes("external_portal"));
});
