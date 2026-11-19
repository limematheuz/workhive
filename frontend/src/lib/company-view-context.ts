import type { User } from "@/types/user";

const permissions = ["can_view_finance", "can_manage_finance", "can_view_labor_costs", "can_manage_labor_costs",
    "can_view_quality", "can_manage_quality", "can_manage_time", "can_approve_time", "can_view_work_reports",
    "can_manage_work_reports", "can_manage_work", "is_initial_worker"] as const;

export function companyViewContext(user: User | null): string {
    return JSON.stringify([user?.id ?? null, user?.company_id ?? null, user?.role.name ?? null,
        ...permissions.map(permission => user?.[permission] ?? null)]);
}
