import assert from "node:assert/strict";
import test from "node:test";
import { assignmentPayload, buildAssignmentDrafts, hasInvalidDraftScopes, replaceDraftScope } from "./organization-assignment-drafts.ts";
import type { OrganizationMember, PermissionProfile } from "../services/organization.service.ts";

test("editing unrelated member fields preserves every scope and inactive assignment", () => {
    const scopes = [
        { id: 1, scope_type: "location" as const, scope_id: 6 },
        { id: 2, scope_type: "team" as const, scope_id: 8 },
    ];
    const member = { profile_assignments: [
        { permission_profile_id: 1, scopes },
        { permission_profile_id: 2, scopes },
        { permission_profile_id: 3, scopes },
    ] } as OrganizationMember;
    const profiles = [
        { id: 1, is_editable: true, is_active: true },
        { id: 2, is_editable: true, is_active: false },
        { id: 3, is_editable: false, is_active: true },
    ] as PermissionProfile[];
    const drafts = buildAssignmentDrafts(member, profiles);
    assert.deepEqual(assignmentPayload(drafts), [1, 2].map(permission_profile_id => ({ permission_profile_id, scopes: [
        { scope_type: "location", scope_id: 6 }, { scope_type: "team", scope_id: 8 },
    ] })));
    const next = replaceDraftScope(drafts[0].scopes, 1, { scope_type: "department", scope_id: 9 });
    assert.deepEqual(next[0], { scope_type: "location", scope_id: 6, draft_id: "scope-1" });
    assert.equal(next[1].draft_id, "scope-2");
    assert.equal(member.profile_assignments[0].scopes[1].scope_id, 8);
    assert.equal(hasInvalidDraftScopes(drafts), false);
});

test("empty, duplicate and unselected scopes fail closed", () => {
    const scope = { scope_type: "company" as const, scope_id: 1 };
    for (const scopes of [[], [scope, scope], [{ ...scope, scope_id: 0 }]]) {
        assert.equal(hasInvalidDraftScopes([{ permission_profile_id: 1, scopes }]), true);
    }
    assert.deepEqual(buildAssignmentDrafts(null, []), []);
});
