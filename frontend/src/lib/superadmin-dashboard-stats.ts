import type { Company } from "../types/company.ts";
import type { TrialRequest } from "../services/trial-request.service.ts";

export type SuperadminDashboardStats = {
    companies: number;
    activeCompanies: number;
    trialCompanies: number;
    teamMembers: number;
    roles: number;
    pendingTrialRequests: number;
};

/** Mirrors company-utils.isCompanyAccessEnabled without UI imports (node:test). */
export function isCompanyAccessEnabled(company: Company): boolean {
    if (!company.is_active) return false;
    if (company.subscription_plan === "none") return false;
    if (["inactive", "canceled", "expired"].includes(company.subscription_status || "")) {
        return false;
    }
    return true;
}

export function isTrialCompany(company: Company): boolean {
    return (
        company.subscription_plan === "trial"
        || company.subscription_status === "trialing"
    );
}

export function countPendingTrialRequests(requests: TrialRequest[]): number {
    return requests.filter((request) => request.status === "email_verified").length;
}

export function buildSuperadminDashboardStats(input: {
    companies: Company[];
    users: { id: number }[];
    roles: { id: number }[];
    trialRequests: TrialRequest[];
}): SuperadminDashboardStats {
    const { companies, users, roles, trialRequests } = input;
    return {
        companies: companies.length,
        activeCompanies: companies.filter(isCompanyAccessEnabled).length,
        trialCompanies: companies.filter(isTrialCompany).length,
        teamMembers: users.length,
        roles: roles.length,
        pendingTrialRequests: countPendingTrialRequests(trialRequests),
    };
}

export function recentCompaniesPreview(companies: Company[], limit = 5): Company[] {
    return [...companies]
        .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }))
        .slice(0, limit);
}

export function pendingTrialRequestsPreview(
    requests: TrialRequest[],
    limit = 5,
): TrialRequest[] {
    return requests
        .filter((request) => request.status === "email_verified")
        .sort(
            (a, b) =>
                new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
        )
        .slice(0, limit);
}
