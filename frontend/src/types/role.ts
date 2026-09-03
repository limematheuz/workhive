export const ROLE_NAMES = [
    "superadmin",
    "admin",
    "external_portal",
    "manager",
    "viewer",
] as const;

export type RoleName = (typeof ROLE_NAMES)[number];

export interface Role {
    id: number;
    name: string;
    description?: string;
    is_active?: boolean;
}
