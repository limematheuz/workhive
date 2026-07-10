import assert from "node:assert/strict";
import test from "node:test";

import { groupCompanyMembers } from "../components/companies/company-members.ts";

test("company members separate admins from the complete worker team", () => {
    const grouped = groupCompanyMembers([
        { id: 1, full_name: "Admin", email: "admin@example.com", role: "admin", is_active: true },
        { id: 2, full_name: "Manager", email: "manager@example.com", role: "manager", is_active: true },
        { id: 3, full_name: "Worker", email: "worker@example.com", role: "viewer", is_active: false },
    ]);

    assert.deepEqual(grouped.admins.map((member) => member.id), [1]);
    assert.deepEqual(grouped.workers.map((member) => member.id), [2, 3]);
});
