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
    legacy_role_name: string | null;
    department_ids: number[];
    team_ids: number[];
    profile_assignments: OrganizationProfileAssignment[];
};

export type OrganizationDepartment = {
    id: number;
    name: string;
    code: string | null;
    parent_department_id: number | null;
    is_active: boolean;
};

export type OrganizationTeam = {
    id: number;
    name: string;
    code: string | null;
    department_id: number | null;
    is_active: boolean;
};

export type PermissionDefinition = {
    id: number;
    code: string;
    category: string;
    description: string;
};

export type PermissionProfile = {
    id: number;
    name: string;
    description: string | null;
    is_system: boolean;
    is_active: boolean;
    permission_codes: string[];
    created_at: string;
    updated_at: string;
};

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const response = await apiFetch(`/api/v1/organization${path}`, init);
    if (!response.ok) {
        throw new Error(await extractErrorMessage(response, "No se pudo actualizar la organización"));
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
    createTeam: (payload: { name: string; code?: string; department_id?: number }) =>
        request<OrganizationTeam>("/teams", {
            method: "POST",
            body: JSON.stringify(payload),
        }),
    createPermissionProfile: (payload: {
        name: string;
        description?: string;
        permission_codes: string[];
    }) => request<PermissionProfile>("/permission-profiles", {
        method: "POST",
        body: JSON.stringify(payload),
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
    replaceMemberProfileAssignments: (membershipId: number, assignments: Array<{
        permission_profile_id: number;
        scopes: Array<{ scope_type: OrganizationScopeType; scope_id: number }>;
    }>) => request<OrganizationMember>(`/members/${membershipId}/profile-assignments`, {
        method: "PUT",
        body: JSON.stringify({ assignments }),
    }),
};
