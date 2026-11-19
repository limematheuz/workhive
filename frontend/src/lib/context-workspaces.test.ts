import assert from "node:assert/strict";
import test from "node:test";
import { companyViewContext } from "./company-view-context.ts";
import { optionalSource } from "./optional-source.ts";
import { isInternalProfile, profileActivityAccess } from "./profile-workspace-access.ts";
import type { User } from "../types/user.ts";

const person: User = { id: 7, email: "fixture@example.test", company_id: 1, role_id: 1,
    role: { id: 1, name: "admin", description: "Admin", is_active: true } };

test("view sessions change with actor, company, role or authorization flags", () => {
    const key = companyViewContext(person);
    for (const next of [{ ...person, id: 8 }, { ...person, company_id: 2 }, { ...person, role: { ...person.role, name: "viewer" } },
            { ...person, can_view_labor_costs: false }, { ...person, can_manage_labor_costs: false }]) {
        assert.notEqual(companyViewContext(next), key);
    }
    assert.notEqual(companyViewContext(null), key);
    assert.equal(companyViewContext({ ...person, full_name: "Nombre actualizado" }), key);
});

test("a finance profile never schedules reads of unrelated operational modules", () => {
    assert.deepEqual(profileActivityAccess({ "finance.read": true }),
        { sessions: false, tasks: false, locations: false, team: false, finance: true });
    assert.deepEqual(profileActivityAccess({ "work.read": true, "time.manage": true }),
        { sessions: true, tasks: true, locations: false, team: false, finance: false });
});

test("external, platform and unassigned profiles do not schedule company activity reads", () => {
    for (const name of ["client_portal", "external_portal", "partner_portal", "superadmin", "unknown"]) {
        assert.equal(isInternalProfile({ company_id: 1, role: { name } }), false);
    }
    assert.equal(isInternalProfile({ company_id: null, role: { name: "admin" } }), false);
    assert.equal(isInternalProfile(person), true);
});

test("unauthorized optional modules are omitted without making a request", async () => {
    let reads = 0;
    const result = await optionalSource(false, async () => { reads++; return [1]; }, [] as number[]);
    assert.equal(reads, 0);
    assert.deepEqual(result, { value: [], available: false, failed: false });
});

test("a recoverable 403 leaves other profile sources usable and never counts as an empty successful result", async () => {
    const [rejected, successful] = await Promise.all([
        optionalSource(true, async () => { throw { status: 403 }; }, [] as number[]),
        optionalSource(true, async () => [7], [] as number[]),
    ]);
    assert.deepEqual(rejected, { value: [], available: false, failed: true });
    assert.deepEqual(successful, { value: [7], available: true, failed: false });
    assert.deepEqual(await optionalSource(true, async () => [], []), { value: [], available: true, failed: false });
});
