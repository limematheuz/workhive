import type {
    OrganizationAccessClass,
    OrganizationDepartment,
    OrganizationMember,
    OrganizationMembershipStatus,
    OrganizationTeam,
    PermissionProfile,
} from "@/services/organization.service";

export type MemberFilters = {
    search: string;
    accessClass: "all" | OrganizationAccessClass;
    status: "all" | OrganizationMembershipStatus;
};

export type DepartmentFilters = {
    search: string;
    status: "all" | "active" | "inactive";
    parentDepartmentId: "all" | "none" | string;
};

export type TeamFilters = {
    search: string;
    status: "all" | "active" | "inactive";
    departmentId: "all" | "none" | string;
};

export type PermissionProfileFilters = {
    search: string;
    type: "all" | "system" | "custom";
    status: "all" | "active" | "inactive";
};

function matchesSearch(search: string, values: Array<string | null | undefined>) {
    const query = search.trim().toLocaleLowerCase();
    return !query || values.some((value) => value?.toLocaleLowerCase().includes(query));
}

export function isHistoricalOrganizationMember(member: OrganizationMember) {
    return member.status === "archived" || member.is_anonymized || (
        member.email.startsWith("deleted+") && member.email.endsWith("@invalid.workhive.local")
    );
}

export function filterOrganizationMembers(
    members: OrganizationMember[],
    filters: MemberFilters,
) {
    return members.filter((member) => {
        const matchesType = filters.accessClass === "all" || member.access_class === filters.accessClass;
        const matchesStatus = filters.status === "all"
            || (filters.status === "archived"
                ? isHistoricalOrganizationMember(member)
                : !isHistoricalOrganizationMember(member) && member.status === filters.status);
        return matchesType && matchesStatus && matchesSearch(filters.search, [
            member.full_name,
            member.email,
            ...member.profile_assignments.map((assignment) => assignment.permission_profile_name),
        ]);
    });
}

export function filterOrganizationDepartments(
    departments: OrganizationDepartment[],
    filters: DepartmentFilters,
) {
    return departments.filter((department) => {
        const matchesStatus = filters.status === "all"
            || (filters.status === "active" ? department.is_active : !department.is_active);
        const matchesParent = filters.parentDepartmentId === "all"
            || (filters.parentDepartmentId === "none"
                ? department.parent_department_id === null
                : department.parent_department_id === Number(filters.parentDepartmentId));
        return matchesStatus && matchesParent && matchesSearch(filters.search, [department.name, department.code]);
    });
}

export function filterOrganizationTeams(
    teams: OrganizationTeam[],
    filters: TeamFilters,
) {
    return teams.filter((team) => {
        const matchesStatus = filters.status === "all"
            || (filters.status === "active" ? team.is_active : !team.is_active);
        const matchesDepartment = filters.departmentId === "all"
            || (filters.departmentId === "none"
                ? team.department_id === null
                : team.department_id === Number(filters.departmentId));
        return matchesStatus && matchesDepartment && matchesSearch(filters.search, [team.name, team.code]);
    });
}

export function filterPermissionProfiles(
    profiles: PermissionProfile[],
    filters: PermissionProfileFilters,
) {
    return profiles.filter((profile) => {
        const matchesType = filters.type === "all"
            || (filters.type === "system" ? profile.is_system : !profile.is_system);
        const matchesStatus = filters.status === "all"
            || (filters.status === "active" ? profile.is_active : !profile.is_active);
        return matchesType && matchesStatus && matchesSearch(filters.search, [
            profile.name,
            profile.description,
            ...profile.permission_codes,
        ]);
    });
}
