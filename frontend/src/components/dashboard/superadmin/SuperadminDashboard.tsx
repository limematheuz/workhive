"use client";

import { startTransition, useCallback, useEffect, useMemo, useState } from "react";
import { Building2, Loader2 } from "lucide-react";

import { SuperadminActivityPanels } from "@/components/dashboard/superadmin/SuperadminActivityPanels";
import { SuperadminNavCards } from "@/components/dashboard/superadmin/SuperadminNavCards";
import { SuperadminStatsCards } from "@/components/dashboard/superadmin/SuperadminStatsCards";
import { PageHeader } from "@/components/ui/page-header";
import { useDictionary } from "@/lib/dictionary-context";
import {
    buildSuperadminDashboardStats,
    pendingTrialRequestsPreview,
    recentCompaniesPreview,
    type SuperadminDashboardStats,
} from "@/lib/superadmin-dashboard-stats";
import { CompanyService, type Company } from "@/services/company.service";
import { RoleService, type Role } from "@/services/role.service";
import {
    TrialRequestService,
    type TrialRequest,
} from "@/services/trial-request.service";
import { UserService } from "@/services/user.service";
import type { User } from "@/types/user";

const EMPTY_STATS: SuperadminDashboardStats = {
    companies: 0,
    activeCompanies: 0,
    trialCompanies: 0,
    teamMembers: 0,
    roles: 0,
    pendingTrialRequests: 0,
};

export function SuperadminDashboard() {
    const { dict } = useDictionary();
    const text = dict.superadmin;

    const [companies, setCompanies] = useState<Company[]>([]);
    const [trialRequests, setTrialRequests] = useState<TrialRequest[]>([]);
    const [stats, setStats] = useState<SuperadminDashboardStats>(EMPTY_STATS);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const loadHubData = useCallback(async () => {
        try {
            setError(null);
            const [fetchedCompanies, fetchedUsers, fetchedRoles, fetchedTrials] =
                await Promise.all([
                    CompanyService.getCompanies().catch(() => [] as Company[]),
                    UserService.getUsers(0, 500).catch(() => [] as User[]),
                    RoleService.getRoles().catch(() => [] as Role[]),
                    TrialRequestService.list().catch(() => [] as TrialRequest[]),
                ]);

            setCompanies(fetchedCompanies);
            setTrialRequests(fetchedTrials);
            setStats(
                buildSuperadminDashboardStats({
                    companies: fetchedCompanies,
                    users: fetchedUsers,
                    roles: fetchedRoles,
                    trialRequests: fetchedTrials,
                }),
            );
        } catch {
            setError(text.error_load);
        } finally {
            setLoading(false);
        }
    }, [text.error_load]);

    useEffect(() => {
        startTransition(() => {
            void loadHubData();
        });
    }, [loadHubData]);

    const companyPreview = useMemo(
        () => recentCompaniesPreview(companies, 5),
        [companies],
    );
    const pendingPreview = useMemo(
        () => pendingTrialRequestsPreview(trialRequests, 5),
        [trialRequests],
    );

    return (
        <div className="dashboard-page-content w-full min-w-0 max-w-full px-[max(3%,env(safe-area-inset-left))] pr-[max(3%,env(safe-area-inset-right))] py-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] md:p-8">
            <PageHeader
                icon={Building2}
                title={text.title}
                subtitle={text.subtitle}
                className="mb-6"
            />

            <section className="billing-surface relative w-full min-w-0 max-w-full overflow-hidden rounded-[24px] p-3 sm:p-5">
                <div className="min-w-0 space-y-5">
                    {loading && companies.length === 0 ? (
                        <div className="flex flex-col items-center justify-center gap-3 py-10">
                            <Loader2 className="h-7 w-7 animate-spin text-accent" />
                            <p className="text-xs font-medium text-[var(--text-muted)]">
                                {text.loading}
                            </p>
                        </div>
                    ) : (
                        <>
                            {error ? (
                                <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-xs font-semibold text-red-600">
                                    {error}
                                </div>
                            ) : null}

                            <SuperadminStatsCards stats={stats} loading={loading} />
                            <SuperadminNavCards />
                            <SuperadminActivityPanels
                                companies={companyPreview}
                                pendingRequests={pendingPreview}
                                loading={loading}
                            />
                        </>
                    )}
                </div>
            </section>
        </div>
    );
}
