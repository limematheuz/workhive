"use client";

import { startTransition, useCallback, useEffect, useMemo, useState } from "react";
import { Building2, Loader2 } from "lucide-react";

import { SuperadminActivityPanels } from "@/components/dashboard/superadmin/SuperadminActivityPanels";
import { CommercialOverviewPanel } from "@/components/dashboard/superadmin/CommercialOverviewPanel";
import { SuperadminNavCards } from "@/components/dashboard/superadmin/SuperadminNavCards";
import { SuperadminStatsCards } from "@/components/dashboard/superadmin/SuperadminStatsCards";
import { Button } from "@/components/ui/button";
import { collectPaginated } from "@/lib/pagination";
import { PageHeader } from "@/components/ui/page-header";
import { useDictionary } from "@/lib/dictionary-context";
import {
    buildSuperadminDashboardStats,
    pendingTrialRequestsPreview,
    recentCompaniesPreview,
    type SuperadminDashboardStats,
} from "@/lib/superadmin-dashboard-stats";
import { CompanyService, type Company } from "@/services/company.service";
import { CompanyPlanAccessService, type CommercialOverview } from "@/services/company-plan-access.service";
import { RoleService } from "@/services/role.service";
import {
    TrialRequestService,
    type TrialRequest,
} from "@/services/trial-request.service";
import { UserService } from "@/services/user.service";

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
    const [commercialOverview, setCommercialOverview] = useState<CommercialOverview | null>(null);
    const [stats, setStats] = useState<SuperadminDashboardStats>(EMPTY_STATS);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const loadHubData = useCallback(async () => {
        try {
            setError(null);
            setLoading(true);
            const [fetchedCompanies, fetchedUsers, fetchedRoles, fetchedTrials, fetchedCommercialOverview] =
                await Promise.all([
                    collectPaginated((skip,limit)=>CompanyService.getCompanies(skip,limit)),
                    collectPaginated((skip,limit)=>UserService.getUsers(skip,limit)),
                    RoleService.getRoles(),
                    TrialRequestService.list(),
                    CompanyPlanAccessService.getCommercialOverview(),
                ]);

            setCompanies(fetchedCompanies);
            setTrialRequests(fetchedTrials);
            setCommercialOverview(fetchedCommercialOverview);
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
                actions={<Button variant="outline" disabled={loading} onClick={()=>void loadHubData()}>Actualizar resumen</Button>}
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
                                    {error}<Button variant="outline" size="sm" className="ml-3" onClick={()=>void loadHubData()}>Reintentar</Button>
                                </div>
                            ) : null}

                            {error?<p className="text-sm text-muted-foreground">Indicadores no disponibles. Reintenta para consultar los datos reales de la plataforma.</p>:<><SuperadminStatsCards stats={stats} loading={loading} />
                            <CommercialOverviewPanel overview={commercialOverview} loading={loading} />
                            <SuperadminActivityPanels
                                companies={companyPreview}
                                pendingRequests={pendingPreview}
                                loading={loading}
                            /></>}<SuperadminNavCards />
                        </>
                    )}
                </div>
            </section>
        </div>
    );
}
