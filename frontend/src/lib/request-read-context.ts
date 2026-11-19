import { companyViewContext } from "./company-view-context.ts";
import type { User } from "@/types/user";

// This is only a namespace for shared in-flight reads; backend authorization remains authoritative.
export function readSessionRequestScope(): string | null {
    if (typeof window === "undefined") return null;
    try {
        const raw = sessionStorage.getItem("workhive_user_cache:v1");
        if (!raw) return null;
        const user = JSON.parse(raw) as User;
        if (!Number.isSafeInteger(user.id) || user.id <= 0 || !Number.isSafeInteger(user.company_id)
                || !user.company_id || user.company_id <= 0 || !["admin", "manager", "viewer"].includes(user.role?.name)) return null;
        return companyViewContext(user);
    } catch { return null; }
}
