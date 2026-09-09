import { apiFetch, extractErrorMessage } from "@/lib/api";

export type OrganizationAccessClass = "admin" | "responsible" | "worker";
export type OrganizationMembershipStatus = "active" | "suspended" | "archived";
export type OrganizationScopeType = "company" | "department" | "team" | "location";

export type OrganizationProfileScope = {
    id: number;
    scope_type: OrganizationScopeType;
    scope_id: number;
};

export type OrganizationProfileAssignment = {
    id: number;
    permission_profile_id: number;
    permission_profile_name: string;
    scopes: OrganizationProfileScope[];
};

export type OrganizationMember = {
    id: number;
    user_id: number;
    full_name: string | null;
    email: string;
    access_class: OrganizationAccessClass;
    status: OrganizationMembershipStatus;
    ended_at: string | null;
    is_anonymized: boolean;
    legacy_role_name: string | null;
    department_ids: number[];
    team_ids: number[];
    profile_assignments: OrganizationProfileAssignment[];
};

export type OrganizationDepartmentUsage = {
    child_departments: number;
    teams: number;
    member_assignments: number;
    profile_scopes: number;
    locations: number;
    can_delete: boolean;
};

export type OrganizationDepartment = {
    id: number;
    name: string;
    code: string | null;
    parent_department_id: number | null;
    is_active: boolean;
    /** Optional only while a local backend is being updated; missing usage disables deletion. */
    usage?: OrganizationDepartmentUsage;
};

export type OrganizationTeam = {
    id: number;
    name: string;
    code: string | null;
    department_id: number | null;
    is_active: boolean;
    /** Omitted only while an older API deployment is being upgraded. */
    usage?: OrganizationTeamUsage;
};

export type OrganizationTeamUsage = {
    member_assignments: number;
    active_member_assignments: number;
    profile_scopes: number;
    active_profile_scopes: number;
    locations: number;
    can_deactivate: boolean;
    can_delete: boolean;
};

export type PermissionDefinition = {
    id: number;
    code: string;
    category: string;
    description: string;
    is_system_only: boolean;
    recommended_for: string[];
};

export type PermissionProfileUsage = {
    assignments: number;
    can_delete: boolean;
};

export type PermissionProfile = {
    id: number;
    name: string;
    description: string | null;
    is_system: boolean;
    is_editable: boolean;
    is_active: boolean;
    permission_codes: string[];
    usage: PermissionProfileUsage;
    created_at: string;
    updated_at: string;
};

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const response = await apiFetch(`/api/v1/organization${path}`, init);
    if (!response.ok) {
        throw new Error(await extractErrorMessage(response, "Could not update organization settings"));
    }
    if (response.status === 204) {
        return undefined as T;
    }
    return response.json() as Promise<T>;
}

export const OrganizationService = {
    getMembers: () => request<OrganizationMember[]>("/members", { cache: "no-store" }),
    getDepartments: () => request<OrganizationDepartment[]>("/departments", { cache: "no-store" }),
    getTeams: () => request<OrganizationTeam[]>("/teams", { cache: "no-store" }),
    getPermissionDefinitions: () => request<PermissionDefinition[]>("/permission-definitions", { cache: "no-store" }),
    getPermissionProfiles: () => request<PermissionProfile[]>("/permission-profiles", { cache: "no-store" }),
    createDepartment: (payload: { name: string; code?: string; parent_department_id?: number }) =>
        request<OrganizationDepartment>("/departments", {
            method: "POST",
            body: JSON.stringify(payload),
        }),
    updateDepartment: (departmentId: number, payload: {
        name?: string;
        code?: string | null;
        parent_department_id?: number | null;
        is_active?: boolean;
    }) => request<OrganizationDepartment>(`/departments/${departmentId}`, {
        method: "PATCH",
        body: JSON.stringify(payload),
    }),
    deleteDepartment: (departmentId: number) => request<void>(`/departments/${departmentId}`, {
        method: "DELETE",
    }),
    createTeam: (payload: { name: string; code?: string; department_id?: number }) =>
        request<OrganizationTeam>("/teams", {
            method: "POST",
            body: JSON.stringify(payload),
        }),
    updateTeam: (teamId: number, payload: {
        name?: string;
        code?: string | null;
        department_id?: number | null;
        is_active?: boolean;
    }) => request<OrganizationTeam>(`/teams/${teamId}`, {
        method: "PATCH",
        body: JSON.stringify(payload),
    }),
    replaceTeamMembers: (teamId: number, membershipIds: number[]) =>
        request<OrganizationTeam>(`/teams/${teamId}/members`, {
            method: "PUT",
            body: JSON.stringify({ membership_ids: membershipIds }),
        }),
    deleteTeam: (teamId: number) => request<void>(`/teams/${teamId}`, {
        method: "DELETE",
    }),
    createPermissionProfile: (payload: {
        name: string;
        description?: string;
        permission_codes: string[];
    }) => request<PermissionProfile>("/permission-profiles", {
        method: "POST",
        body: JSON.stringify(payload),
        }),
    updatePermissionProfile: (profileId: number, payload: {
        name?: string;
        description?: string | null;
        permission_codes?: string[];
        is_active?: boolean;
    }) => request<PermissionProfile>(`/permission-profiles/${profileId}`, {
        method: "PATCH",
        body: JSON.stringify(payload),
    }),
    deletePermissionProfile: (profileId: number) => request<void>(`/permission-profiles/${profileId}`, {
        method: "DELETE",
    }),
    updateMember: (membershipId: number, payload: {
        access_class?: OrganizationAccessClass;
        status?: OrganizationMembershipStatus;
        department_ids?: number[];
        team_ids?: number[];
    }) => request<OrganizationMember>(`/members/${membershipId}`, {
        method: "PATCH",
        body: JSON.stringify(payload),
    }),
    removeMember: (membershipId: number) => request<void>(`/members/${membershipId}`, {
        method: "DELETE",
    }),
    replaceMemberProfileAssignments: (membershipId: number, assignments: Array<{
        permission_profile_id: number;
        scopes: Array<{ scope_type: OrganizationScopeType; scope_id: number }>;
    }>) => request<OrganizationMember>(`/members/${membershipId}/profile-assignments`, {
        method: "PUT",
        body: JSON.stringify({ assignments }),
    }),
};
