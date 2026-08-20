import assert from "node:assert/strict";
import test from "node:test";

import { COMPANY_ASSIGNABLE_ROLE_NAMES } from "../components/users/user-role-utils.ts";

test("company administrators can assign the accountant role", () => {
    assert.ok(COMPANY_ASSIGNABLE_ROLE_NAMES.includes("accountant"));
});
