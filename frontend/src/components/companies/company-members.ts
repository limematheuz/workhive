export interface CompanyMember {
    id: number;
    full_name?: string | null;
    email: string;
    role: string;
    is_active: boolean;
}

export function groupCompanyMembers(members: CompanyMember[]) {
    return {
        admins: members.filter((member) => member.role === "admin"),
        workers: members.filter((member) => member.role !== "admin"),
    };
}
