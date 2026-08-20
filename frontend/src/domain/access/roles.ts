import { ROLE_NAMES, type RoleName } from "../../types/role.ts";
import type { User } from "../../types/user.ts";

const COMPANY_TASK_MANAGERS = new Set<RoleName>([
    "superadmin",
    "admin",
    "manager",
]);
const COMPANY_ADMINS = new Set<RoleName>(["superadmin", "admin"]);
const FINANCIAL_READERS = new Set<RoleName>(["superadmin", "admin", "accountant"]);
const CALENDAR_MANAGERS = new Set<RoleName>(["admin", "manager"]);
const CALENDAR_VIEWERS = new Set<RoleName>(["admin", "manager", "viewer"]);

export function getRoleName(user?: User | null): RoleName | null {
    const role = user?.role?.name;
    return ROLE_NAMES.includes(role as RoleName) ? role as RoleName : null;
}

export function isCompanyTaskManagerRole(
    role: RoleName | string | null | undefined,
): boolean {
    return Boolean(role && COMPANY_TASK_MANAGERS.has(role as RoleName));
}

export function isCompanyAdminRole(
    role: RoleName | string | null | undefined,
): boolean {
    return Boolean(role && COMPANY_ADMINS.has(role as RoleName));
}

export function isAccountantRole(
    role: RoleName | string | null | undefined,
): boolean {
    return role === "accountant";
}

export function canViewFinanceRole(
    role: RoleName | string | null | undefined,
): boolean {
    return Boolean(role && FINANCIAL_READERS.has(role as RoleName));
}

export function isCalendarManagerRole(
    role: RoleName | string | null | undefined,
): boolean {
    return Boolean(role && CALENDAR_MANAGERS.has(role as RoleName));
}

export function isCalendarViewerRole(
    role: RoleName | string | null | undefined,
): boolean {
    return Boolean(role && CALENDAR_VIEWERS.has(role as RoleName));
}

export function canManageCompanyTasks(user?: User | null): boolean {
    return isCompanyTaskManagerRole(getRoleName(user));
}

export function canAdministerCompany(user?: User | null): boolean {
    return isCompanyAdminRole(getRoleName(user));
}

export function canViewFinance(user?: User | null): boolean {
    return canViewFinanceRole(getRoleName(user));
}

export function canManageCompanyCalendar(user?: User | null): boolean {
    return isCalendarManagerRole(getRoleName(user));
}

export function canViewCompanyCalendar(user?: User | null): boolean {
    return isCalendarViewerRole(getRoleName(user));
}

export function canConnectCompanyCalendar(user?: User | null): boolean {
    return canAdministerCompany(user) && Boolean(user?.company_id);
}

export function isSuperadmin(user?: User | null): boolean {
    return getRoleName(user) === "superadmin";
}

export function isPlatformSuperadmin(user?: User | null): boolean {
    return isSuperadmin(user) && user?.company_id == null;
}
