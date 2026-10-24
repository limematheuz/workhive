import type { OrganizationMember, OrganizationScopeType, PermissionProfile } from "../services/organization.service.ts";

export type ScopeDraft = { scope_type: OrganizationScopeType; scope_id: number; draft_id?: string };
export type AssignmentDraft = { permission_profile_id: number; scopes: ScopeDraft[] };

export function buildAssignmentDrafts(member: OrganizationMember | null, profiles: PermissionProfile[]): AssignmentDraft[] {
    const editableIds = new Set<number>();
    for (const profile of profiles) if (profile.is_editable) editableIds.add(profile.id);
    const drafts: AssignmentDraft[] = [];
    for (const assignment of member?.profile_assignments ?? []) {
        if (editableIds.has(assignment.permission_profile_id)) drafts.push({
            permission_profile_id: assignment.permission_profile_id,
            scopes: assignment.scopes.map(({ id, scope_type, scope_id }) => ({ scope_type, scope_id, draft_id: `scope-${id}` })),
        });
    }
    return drafts;
}

export function assignmentPayload(assignments: AssignmentDraft[]): AssignmentDraft[] {
    return assignments.map(assignment => ({ ...assignment, scopes: assignment.scopes.map(({ scope_type, scope_id }) => ({ scope_type, scope_id })) }));
}

export function haveProfileAssignmentsChanged(member: OrganizationMember, profiles: PermissionProfile[], drafts: AssignmentDraft[]): boolean {
    const signature = (assignments: AssignmentDraft[]) => JSON.stringify(assignmentPayload(assignments)
        .map(({ permission_profile_id, scopes }) => ({
            permission_profile_id,
            scopes: scopes.map(({ scope_type, scope_id }) => `${scope_type}:${scope_id}`).sort(),
        }))
        .sort((a, b) => a.permission_profile_id - b.permission_profile_id));
    return signature(buildAssignmentDrafts(member, profiles)) !== signature(drafts);
}

export function replaceDraftScope(scopes: ScopeDraft[], index: number, scope: ScopeDraft): ScopeDraft[] {
    return scopes.map((current, position) => position === index ? { ...current, ...scope } : current);
}

export function hasInvalidDraftScopes(assignments: AssignmentDraft[]): boolean {
    return assignments.some(({ scopes }) => !scopes.length || scopes.some(scope => scope.scope_id <= 0)
        || new Set(scopes.map(scope => `${scope.scope_type}:${scope.scope_id}`)).size !== scopes.length);
}
