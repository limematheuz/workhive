export const COMPANY_ASSIGNABLE_ROLE_NAMES = [
    "superadmin",
    "admin",
    "manager",
    "viewer",
    "accountant",
] as const;

export const getRoleRank = (roleName?: string) => {
    switch (roleName) {
        case "superadmin": return 4;
        case "admin": return 3;
        case "manager": return 2;
        case "installer": return 1;
        case "viewer": return 0;
        default: return -1;
    }
};

export const getRoleText = (roleName: string, labels: {
    role_superadmin?: string;
    role_admin?: string;
    role_accountant?: string;
    role_manager?: string;
    role_installer?: string;
    role_viewer?: string;
}) => {
    switch (roleName) {
        case "superadmin":
            return labels.role_superadmin || "superadmin";
        case "admin":
            return labels.role_admin || "administrador";
        case "accountant":
            return labels.role_accountant || "gestor";
        case "manager":
            return labels.role_manager || "gerente";
        case "installer":
            return labels.role_installer || "trabajador";
        case "viewer":
            return labels.role_viewer || "trabajador";
        default:
            return roleName.toUpperCase();
    }
};
