export interface CompanyMember {
    id: number;
    full_name?: string | null;
    email: string;
    role: string;
    is_active: boolean;
}

export function groupCompanyMembers(members: CompanyMember[]) {
    const companyMembers = members.filter((member) => member.role !== "superadmin");
    return {
        admins: companyMembers.filter((member) => member.role === "admin"),
        workers: companyMembers.filter((member) => member.role !== "admin"),
    };
}
