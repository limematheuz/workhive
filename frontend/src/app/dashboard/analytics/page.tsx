"use client";

import {
    useCallback,
    useEffect,
    useEffectEvent,
    useMemo,
    useRef,
    useState,
} from "react";
import { redirect } from "next/navigation";
import {
    Activity,
    ArrowDownRight,
    BarChart3,
    CheckCircle2,
    Clock3,
    Download,
    Inbox,
    Loader2,
    Package,
    PieChart,
    ReceiptText,
    TriangleAlert,
    UsersRound,
} from "lucide-react";

import { canManageFinance, canViewFinance, canViewLaborCosts, isExternalPortalRole, isPlatformSuperadmin } from "@/domain/access/roles";
import { PageHeader } from "@/components/ui/page-header";
import { PremiumTabs } from "@/components/ui/premium-tabs";
import { ReadRecoveryBanner } from "@/components/ui/read-recovery-banner";
import {
    classifyReadError,
    getReadRecoveryMessage,
    getReadWorkspaceKey,
    shouldShowReadRetry,
    type ReadErrorKind,
} from "@/lib/read-recovery";
import { useRealtimeInvalidation } from "@/hooks/useRealtimeEvents";
import {
    buildFinanceSeries,
    groupExpensesByCategory,
    summarizeFinancePeriod,
    type FinancePeriod,
    type FinancePeriodSummary,
    type FinanceRevenueRecord,
    type FinanceSeriesPoint,
    type FinancePaymentRecord,
} from "@/lib/finance-analytics";
import { useDictionary } from "@/lib/dictionary-context";
import { formatCurrency } from "@/lib/format";
import { getPercentageChange } from "@/lib/metric-trend";
import { useUser } from "@/lib/user-context";
import { useProfile, type TaskChartStats } from "@/hooks/useProfile";
import { InteractiveLineChart } from "@/components/dashboard/InteractiveLineChart";
import { FinanceOverviewService } from "@/services/finance-overview.service";
import type { Expense } from "@/types/expense";
import { toast } from "@/lib/toast";
import { accountantExportYears, type AccountantExportPeriod } from "@/lib/accountant-export";
import { AccountantExportService } from "@/services/accountant-export.service";
import { PAGE_ACTION_BUTTON_PRIMARY } from "@/lib/page-action-button";
import {
    ClientProfitabilityService,
    type ClientProfitability,
    type ClientProfitabilityPeriod,
} from "@/services/client-profitability.service";
import { DataListTable, type DataListColumn } from "@/components/ui/data-list-table";
import { SummaryMetricCard, SummaryMetricGrid } from "@/components/ui/summary-metric-card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CompanyPlanAccessService } from "@/services/company-plan-access.service";
import { BankReconciliationSection } from "@/components/analytics/BankReconciliationSection";
import { OperationalMarginExplorer } from "@/components/analytics/OperationalMarginExplorer";
import { ServiceContractService } from "@/services/service-contract.service";
import { WorkOrderService } from "@/services/work-order.service";
import { LocationService } from "@/services/location.service";
import { ServiceMarginService } from "@/services/service-margin.service";
import { TeamLaborCostService } from "@/services/team-labor-cost.service";
import type { ServiceContract } from "@/types/service-contract";
import type { Location } from "@/types/location";
import type { WorkOrder } from "@/types/work-order";
import type { ServiceMarginScope, TeamLaborCost } from "@/types/margin-forecast";

type AnalyticsTab = "finance" | "profitability" | "operational_margin" | "reconciliation" | "operations";

const PERIODS: FinancePeriod[] = ["day", "week", "month", "year"];

const FINANCE_LINES = [
    { key: "revenue", color: "var(--status-active-text)", labelKey: "revenue", strokeOpacity: 0.82 },
    { key: "expenses", color: "var(--btn-cancel-hover-bg)", labelKey: "expenses", strokeOpacity: 0.98 },
    { key: "profit", color: "var(--brand-blue-bright)", labelKey: "profit", strokeOpacity: 0.98 },
] as const;

export default function FinanceAnalyticsPage() {
    const { dict, locale } = useDictionary();
    const { user, loading: userLoading } = useUser();
    const canViewAnalytics = canViewFinance(user) && !isPlatformSuperadmin(user);
    const canManageAnalytics = canManageFinance(user) && !isPlatformSuperadmin(user);
    const canViewOperationalMargin = canViewFinance(user) && canViewLaborCosts(user) && !isPlatformSuperadmin(user);
    const isAccountant = isExternalPortalRole(user?.role?.name);
    const text = dict.finance_analytics;
    const profileCharts = useProfile();

    const [activeTab, setActiveTab] = useState<AnalyticsTab>("finance");
    const [period, setPeriod] = useState<FinancePeriod>("month");
    const [revenueRecords, setRevenueRecords] = useState<FinanceRevenueRecord[]>([]);
    const [expenses, setExpenses] = useState<Expense[]>([]);
    const [payments, setPayments] = useState<FinancePaymentRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [financeErrorKind, setFinanceErrorKind] = useState<ReadErrorKind | null>(null);
    const [hasFinanceSnapshot, setHasFinanceSnapshot] = useState(false);
    const financeRequestIdRef = useRef(0);
    const financeLoadedWorkspaceRef = useRef<string | null>(null);
    const [exportYear, setExportYear] = useState(() => new Date().getFullYear());
    const [exportPeriod, setExportPeriod] = useState<AccountantExportPeriod>("month");
    const [exportPeriodNumber, setExportPeriodNumber] = useState(() => new Date().getMonth() + 1);
    const [exportingAccountantPackage, setExportingAccountantPackage] = useState(false);
    const [profitabilityPeriod, setProfitabilityPeriod] = useState<ClientProfitabilityPeriod>("month");
    const [profitability, setProfitability] = useState<ClientProfitability | null>(null);
    const [profitabilityLoading, setProfitabilityLoading] = useState(false);
    const [profitabilityErrorKind, setProfitabilityErrorKind] = useState<ReadErrorKind | null>(null);
    const profitabilityRequestIdRef = useRef(0);
    const profitabilityLoadedKeyRef = useRef<string | null>(null);
    const [enabledFeatures, setEnabledFeatures] = useState<Set<string> | null>(null);
    const [entitlementsErrorKind, setEntitlementsErrorKind] = useState<ReadErrorKind | null>(null);
    const entitlementsRequestIdRef = useRef(0);
    const entitlementsLoadedWorkspaceRef = useRef<string | null>(null);
    const [marginContracts, setMarginContracts] = useState<ServiceContract[]>([]);
    const [marginWorkOrders, setMarginWorkOrders] = useState<WorkOrder[]>([]);
    const [marginLocations, setMarginLocations] = useState<Location[]>([]);
    const [marginServices, setMarginServices] = useState<ServiceMarginScope[]>([]);
    const [marginTeamLaborCosts, setMarginTeamLaborCosts] = useState<TeamLaborCost[]>([]);
    const [marginCatalogsLoading, setMarginCatalogsLoading] = useState(false);
    const [marginCatalogsErrorKind, setMarginCatalogsErrorKind] = useState<ReadErrorKind | null>(null);
    const marginCatalogsRequestIdRef = useRef(0);
    const marginCatalogsLoadedWorkspaceRef = useRef<string | null>(null);

    const workspaceKey = getReadWorkspaceKey(user);
    const isSuperadmin = isPlatformSuperadmin(user);
    const companyId = user?.company_id ?? null;
    const profitabilitySnapshotKey = `${workspaceKey}:${profitabilityPeriod}`;

    const loadEntitlements = useCallback(async () => {
        if (userLoading || isSuperadmin || !companyId) return;
        const requestId = ++entitlementsRequestIdRef.current;
        if (entitlementsLoadedWorkspaceRef.current !== workspaceKey) {
            setEnabledFeatures(null);
        }
        setEntitlementsErrorKind(null);
        try {
            const access = await CompanyPlanAccessService.getCurrentEntitlements();
            if (requestId !== entitlementsRequestIdRef.current) return;
            const nextEnabledFeatures = new Set<string>();
            access.entitlements.forEach((entitlement) => {
                if (entitlement.value_type === "boolean" && entitlement.value === true) {
                    nextEnabledFeatures.add(entitlement.code);
                }
            });
            entitlementsLoadedWorkspaceRef.current = workspaceKey;
            setEnabledFeatures(nextEnabledFeatures);
            setEntitlementsErrorKind(null);
        } catch (error) {
            if (requestId !== entitlementsRequestIdRef.current) return;
            const kind = classifyReadError(error);
            if (kind === "denied" || entitlementsLoadedWorkspaceRef.current !== workspaceKey) {
                entitlementsLoadedWorkspaceRef.current = null;
                setEnabledFeatures(null);
            }
            setEntitlementsErrorKind(kind);
        }
    }, [companyId, isSuperadmin, userLoading, workspaceKey]);

    const syncEntitlements = useEffectEvent(() => {
        void loadEntitlements();
    });

    useEffect(() => {
        if (userLoading || isSuperadmin || !companyId) return;
        const timer = window.setTimeout(() => syncEntitlements(), 0);
        return () => window.clearTimeout(timer);
    }, [companyId, isSuperadmin, userLoading, workspaceKey]);

    const companyFeatures = userLoading || isPlatformSuperadmin(user) || !user?.company_id
        ? null
        : enabledFeatures;
    const canViewProfitability = companyFeatures?.has("features.profitability") ?? false;
    const canDownloadAccountantPackage = companyFeatures?.has("features.accountant_portal") ?? false;

    const financePlanReady = companyFeatures !== null;
    const invoicesEnabled = companyFeatures?.has("features.invoices") ?? false;

    const loadAnalytics = useCallback(async () => {
        if (!canViewAnalytics || !financePlanReady) return;
        const requestId = ++financeRequestIdRef.current;
        if (financeLoadedWorkspaceRef.current !== workspaceKey) {
            setRevenueRecords([]);
            setExpenses([]);
            setPayments([]);
            setHasFinanceSnapshot(false);
        }
        setLoading(true);
        setFinanceErrorKind(null);
        try {
            const snapshot = await FinanceOverviewService.getSnapshot({ includeInvoices: invoicesEnabled });
            if (requestId !== financeRequestIdRef.current) return;
            setRevenueRecords(snapshot.revenue);
            setExpenses(snapshot.expenses);
            setPayments(snapshot.payments);
            financeLoadedWorkspaceRef.current = workspaceKey;
            setHasFinanceSnapshot(true);
            setFinanceErrorKind(null);
        } catch (error) {
            if (requestId !== financeRequestIdRef.current) return;
            console.error("Error loading finance analytics", error);
            const kind = classifyReadError(error);
            if (kind === "denied" || financeLoadedWorkspaceRef.current !== workspaceKey) {
                financeLoadedWorkspaceRef.current = null;
                setRevenueRecords([]);
                setExpenses([]);
                setPayments([]);
                setHasFinanceSnapshot(false);
            }
            setFinanceErrorKind(kind);
        } finally {
            setLoading((current) => (requestId === financeRequestIdRef.current ? false : current));
        }
    }, [canViewAnalytics, financePlanReady, invoicesEnabled, workspaceKey]);

    const loadProfitability = useCallback(async () => {
        if (!canViewAnalytics || !canViewProfitability) return;
        const requestId = ++profitabilityRequestIdRef.current;
        if (profitabilityLoadedKeyRef.current !== profitabilitySnapshotKey) {
            setProfitability(null);
        }
        setProfitabilityLoading(true);
        setProfitabilityErrorKind(null);
        try {
            const next = await ClientProfitabilityService.getProfitability(profitabilityPeriod);
            if (requestId !== profitabilityRequestIdRef.current) return;
            profitabilityLoadedKeyRef.current = profitabilitySnapshotKey;
            setProfitability(next);
            setProfitabilityErrorKind(null);
        } catch (error) {
            if (requestId !== profitabilityRequestIdRef.current) return;
            console.error("Error loading client profitability", error);
            const kind = classifyReadError(error);
            if (kind === "denied" || profitabilityLoadedKeyRef.current !== profitabilitySnapshotKey) {
                profitabilityLoadedKeyRef.current = null;
                setProfitability(null);
            }
            setProfitabilityErrorKind(kind);
        } finally {
            setProfitabilityLoading((current) => (requestId === profitabilityRequestIdRef.current ? false : current));
        }
    }, [canViewAnalytics, canViewProfitability, profitabilityPeriod, profitabilitySnapshotKey]);

    const loadOperationalMarginCatalogs = useCallback(async () => {
        if (!canViewOperationalMargin || !canViewProfitability) return;
        const requestId = ++marginCatalogsRequestIdRef.current;
        if (marginCatalogsLoadedWorkspaceRef.current !== workspaceKey) {
            setMarginContracts([]);
            setMarginWorkOrders([]);
            setMarginLocations([]);
            setMarginServices([]);
            setMarginTeamLaborCosts([]);
        }
        setMarginCatalogsLoading(true);
        setMarginCatalogsErrorKind(null);
        try {
            const [contractsResult, workOrdersResult, locationsResult, servicesResult, teamCostsResult] = await Promise.allSettled([
                ServiceContractService.getContracts(),
                WorkOrderService.getWorkOrders(),
                LocationService.getLocations(),
                ServiceMarginService.getScopes(),
                TeamLaborCostService.getSummaries(),
            ]);
            if (requestId !== marginCatalogsRequestIdRef.current) return;
            if (contractsResult.status === "rejected") throw contractsResult.reason;
            if (workOrdersResult.status === "rejected") throw workOrdersResult.reason;
            if (locationsResult.status === "rejected") throw locationsResult.reason;
            if (servicesResult.status === "rejected") throw servicesResult.reason;
            if (teamCostsResult.status === "rejected") throw teamCostsResult.reason;
            marginCatalogsLoadedWorkspaceRef.current = workspaceKey;
            setMarginContracts(contractsResult.value);
            setMarginWorkOrders(workOrdersResult.value);
            setMarginLocations(locationsResult.value);
            setMarginServices(servicesResult.value);
            setMarginTeamLaborCosts(teamCostsResult.value);
            setMarginCatalogsErrorKind(null);
        } catch (error) {
            if (requestId !== marginCatalogsRequestIdRef.current) return;
            console.error("Error loading operational margin catalogs", error);
            const kind = classifyReadError(error);
            if (kind === "denied" || marginCatalogsLoadedWorkspaceRef.current !== workspaceKey) {
                marginCatalogsLoadedWorkspaceRef.current = null;
                setMarginContracts([]);
                setMarginWorkOrders([]);
                setMarginLocations([]);
                setMarginServices([]);
                setMarginTeamLaborCosts([]);
            }
            setMarginCatalogsErrorKind(kind);
        } finally {
            setMarginCatalogsLoading((current) => (requestId === marginCatalogsRequestIdRef.current ? false : current));
        }
    }, [canViewOperationalMargin, canViewProfitability, workspaceKey]);

    const syncAnalytics = useEffectEvent(() => {
        void loadAnalytics();
    });
    const syncProfitability = useEffectEvent(() => {
        void loadProfitability();
    });
    const syncOperationalMarginCatalogs = useEffectEvent(() => {
        void loadOperationalMarginCatalogs();
    });

    useEffect(() => {
        if (userLoading || !canViewAnalytics || !financePlanReady) return;
        const timer = window.setTimeout(() => {
            syncAnalytics();
        }, 0);
        return () => window.clearTimeout(timer);
    }, [canViewAnalytics, financePlanReady, invoicesEnabled, userLoading, workspaceKey]);

    useEffect(() => {
        if (userLoading || !canViewProfitability || activeTab !== "profitability") return;
        const timer = window.setTimeout(() => {
            syncProfitability();
        }, 0);
        return () => window.clearTimeout(timer);
    }, [activeTab, canViewProfitability, profitabilitySnapshotKey, userLoading]);

    useEffect(() => {
        if (userLoading || !canViewProfitability || activeTab !== "operational_margin") return;
        const timer = window.setTimeout(() => {
            syncOperationalMarginCatalogs();
        }, 0);
        return () => window.clearTimeout(timer);
    }, [activeTab, canViewProfitability, userLoading, workspaceKey]);

    useRealtimeInvalidation(["dashboard"], () => {
        void loadAnalytics();
        if (activeTab === "profitability") void loadProfitability();
        if (activeTab === "operational_margin") void loadOperationalMarginCatalogs();
    });

    useEffect(() => {
        if (
            (!canViewProfitability && activeTab === "profitability")
            || (!(canViewProfitability && canViewOperationalMargin) && activeTab === "operational_margin")
        ) {
            const timer = window.setTimeout(() => setActiveTab("finance"), 0);
            return () => window.clearTimeout(timer);
        }
    }, [activeTab, canViewOperationalMargin, canViewProfitability]);

    const downloadAccountantPackage = useCallback(async () => {
        try {
            setExportingAccountantPackage(true);
            await AccountantExportService.downloadForAccountant(
                exportYear,
                exportPeriod,
                exportPeriod === "year" ? undefined : exportPeriodNumber,
            );
            toast.success(text.accountant_export_success);
        } catch (error) {
            console.error("Error exporting accountant package", error);
            toast.error(error instanceof Error ? error.message : text.accountant_export_error);
        } finally {
            setExportingAccountantPackage(false);
        }
    }, [exportPeriod, exportPeriodNumber, exportYear, text.accountant_export_error, text.accountant_export_success]);

    const periodNumberOptions = exportPeriod === "month"
        ? Array.from({ length: 12 }, (_, index) => index + 1)
        : exportPeriod === "quarter"
            ? [1, 2, 3, 4]
            : exportPeriod === "semester"
                ? [1, 2]
                : [];
    const accountantMonthFormatter = useMemo(
        () => new Intl.DateTimeFormat(locale, { month: "long" }),
        [locale],
    );

    const series = useMemo(
        () => buildFinanceSeries(revenueRecords, expenses, locale, period, new Date(), payments),
        [expenses, revenueRecords, locale, payments, period],
    );
    const comparison = useMemo(
        () => summarizeFinancePeriod(revenueRecords, expenses, period, new Date(), payments),
        [expenses, revenueRecords, payments, period],
    );
    const categoryTotals = useMemo(
        () => groupExpensesByCategory(expenses, period),
        [expenses, period],
    );

    const financeErrorMessage = getReadRecoveryMessage(financeErrorKind, {
        unavailable: text.error_load,
        denied: text.error_denied,
    });
    const entitlementsErrorMessage = getReadRecoveryMessage(entitlementsErrorKind, {
        unavailable: text.entitlements_error_load,
        denied: text.error_denied,
    });
    const retryFinanceScope = () => {
        void loadAnalytics();
        if (entitlementsErrorKind !== null) {
            void loadEntitlements();
        }
    };

    if (!userLoading && !canViewAnalytics) redirect("/dashboard");

    if (userLoading || (loading && !hasFinanceSnapshot && !financeErrorKind && !entitlementsErrorKind)) {
        return (
            <div className="flex h-full items-center justify-center gap-3 text-[var(--text-muted)]">
                <Loader2 className="h-5 w-5 animate-spin text-accent" />
                <span className="text-sm font-semibold">{text.loading}</span>
            </div>
        );
    }

    if (!canViewAnalytics) return null;

    return (
        <div className="min-h-full px-3 py-3 sm:px-5 lg:px-6">
            <div className="mx-auto flex w-full max-w-[112rem] flex-col gap-4">
                <PageHeader
                    icon={BarChart3}
                    title={text.title}
                    subtitle={text.eyebrow}
                    actions={(
                        <PremiumTabs<AnalyticsTab>
                            tabs={isAccountant
                                ? [{ id: "finance", label: text.tab_finance }]
                                : [
                                    { id: "finance", label: text.tab_finance },
                                    ...(canViewProfitability ? [{ id: "profitability" as const, label: text.tab_profitability }] : []),
                                    ...(canViewProfitability && canViewOperationalMargin ? [{ id: "operational_margin" as const, label: text.tab_operational_margin }] : []),
                                    { id: "reconciliation", label: text.tab_reconciliation },
                                    { id: "operations", label: text.tab_operations },
                                ]}
                            activeTab={activeTab}
                            onChange={setActiveTab}
                            className="w-full sm:min-w-72"
                        />
                    )}
                />

                {entitlementsErrorKind && entitlementsErrorMessage && (activeTab !== "finance" || !financeErrorKind) ? (
                    <ReadRecoveryBanner
                        kind={entitlementsErrorKind}
                        message={entitlementsErrorMessage}
                        retryLabel={text.retry}
                        onRetry={shouldShowReadRetry(entitlementsErrorKind) ? () => void loadEntitlements() : undefined}
                    />
                ) : null}

                {activeTab === "finance" && canDownloadAccountantPackage ? (
                    <div className="flex flex-wrap items-center justify-end gap-2">
                        <Select value={String(exportYear)} onValueChange={(value) => setExportYear(Number(value))}>
                            <SelectTrigger className="w-full sm:w-36" aria-label={text.accountant_export_year}>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {accountantExportYears(new Date().getFullYear()).map((year) => (
                                    <SelectItem key={year} value={String(year)}>{year}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <Select
                            value={exportPeriod}
                            onValueChange={(value) => {
                                setExportPeriod(value as AccountantExportPeriod);
                                setExportPeriodNumber(1);
                            }}
                        >
                            <SelectTrigger className="w-full sm:w-40" aria-label={text.accountant_export_period}>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="month">{text.accountant_export_month}</SelectItem>
                                <SelectItem value="quarter">{text.accountant_export_quarter}</SelectItem>
                                <SelectItem value="semester">{text.accountant_export_semester}</SelectItem>
                                <SelectItem value="year">{text.accountant_export_annual}</SelectItem>
                            </SelectContent>
                        </Select>
                        {exportPeriod !== "year" ? (
                            <Select value={String(exportPeriodNumber)} onValueChange={(value) => setExportPeriodNumber(Number(value))}>
                                <SelectTrigger className="w-full sm:w-44" aria-label={text.accountant_export_period_number}>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {periodNumberOptions.map((periodNumber) => (
                                        <SelectItem key={periodNumber} value={String(periodNumber)}>
                                            {exportPeriod === "month"
                                                ? accountantMonthFormatter.format(new Date(2026, periodNumber - 1, 1))
                                                : `${exportPeriod === "quarter" ? "T" : "S"}${periodNumber}`}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        ) : null}
                        <Button
                            type="button"
                            onClick={() => void downloadAccountantPackage()}
                            disabled={exportingAccountantPackage}
                            className={PAGE_ACTION_BUTTON_PRIMARY}
                        >
                            {exportingAccountantPackage ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                            <span>{text.accountant_export}</span>
                        </Button>
                    </div>
                ) : null}

                {activeTab === "finance" ? (
                    <>
                        {financeErrorKind && financeErrorMessage ? (
                            <ReadRecoveryBanner
                                kind={financeErrorKind}
                                message={financeErrorMessage}
                                retryLabel={text.retry}
                                onRetry={shouldShowReadRetry(financeErrorKind) ? retryFinanceScope : undefined}
                                retrying={loading}
                            />
                        ) : null}
                        {hasFinanceSnapshot ? (
                            <FinanceDashboard
                                text={text}
                                series={series}
                                comparison={comparison}
                                categoryTotals={categoryTotals}
                                categoryLabels={dict.expenses.categories}
                                period={period}
                                setPeriod={setPeriod}
                            />
                        ) : null}
                    </>
                ) : activeTab === "profitability" ? (
                    <ClientProfitabilityDashboard
                        text={text}
                        data={profitability}
                        loading={profitabilityLoading}
                        errorKind={profitabilityErrorKind}
                        onRetry={() => void loadProfitability()}
                        period={profitabilityPeriod}
                        setPeriod={setProfitabilityPeriod}
                    />
                ) : activeTab === "operational_margin" ? (
                    <OperationalMarginExplorer
                        contracts={marginContracts}
                        workOrders={marginWorkOrders}
                        locations={marginLocations}
                        services={marginServices}
                        teamLaborCosts={marginTeamLaborCosts}
                        loading={marginCatalogsLoading}
                        errorKind={marginCatalogsErrorKind}
                        onRetry={() => void loadOperationalMarginCatalogs()}
                        canManage={canManageAnalytics}
                        copy={text}
                    />
                ) : activeTab === "reconciliation" ? (
                    <BankReconciliationSection copy={text} canManage={canManageAnalytics} />
                ) : (
                    <OperationsDashboard
                        text={text}
                        dict={dict}
                        loading={profileCharts.loading}
                        stats={profileCharts.isViewer ? profileCharts.installerWeeklyStats : profileCharts.companyTaskStats}
                    />
                )}
            </div>
        </div>
    );
}

function FinanceDashboard({
    text,
    series,
    comparison,
    categoryTotals,
    categoryLabels,
    period,
    setPeriod,
}: {
    text: Record<string, string>;
    series: FinanceSeriesPoint[];
    comparison: { current: FinancePeriodSummary; previous: FinancePeriodSummary };
    categoryTotals: Array<{ category: string; total: number }>;
    categoryLabels: Record<string, string>;
    period: FinancePeriod;
    setPeriod: (period: FinancePeriod) => void;
}) {
    const { current, previous } = comparison;
    const metricCards = [
        {
            label: text.paid_collected,
            value: current.paid,
            previous: previous.paid,
            icon: CheckCircle2,
            comparisonDirection: "higher" as const,
        },
        {
            label: text.pending,
            value: current.pending,
            previous: previous.pending,
            icon: Clock3,
            comparisonDirection: "lower" as const,
        },
        {
            label: text.expenses,
            value: current.expenses,
            previous: previous.expenses,
            icon: ReceiptText,
            comparisonDirection: "lower" as const,
        },
        {
            label: text.profit,
            value: current.profit,
            previous: previous.profit,
            icon: BarChart3,
            comparisonDirection: "higher" as const,
        },
        {
            label: text.overdue,
            value: current.overdue,
            previous: previous.overdue,
            icon: TriangleAlert,
            comparisonDirection: "lower" as const,
        },
        {
            label: text.vat_balance,
            value: current.vatBalance,
            previous: previous.vatBalance,
            icon: ReceiptText,
            comparisonDirection: "lower" as const,
        },
    ];

    return (
        <>
            <SummaryMetricGrid desktopColumns={6} className="gap-2.5 sm:grid-cols-3">
                {metricCards.map(({ label, value, previous, icon, comparisonDirection }) => {
                    const change = getPercentageChange(value, previous);
                    return <SummaryMetricCard key={label} label={label} value={formatCurrency(value)} icon={icon} trend={change === null ? undefined : { value: change, comparisonDirection }} />;
                })}
            </SummaryMetricGrid>

            <section className="grid gap-4 xl:grid-cols-[minmax(0,1.55fr)_minmax(20rem,0.62fr)]">
                <FinanceTrendCard
                    text={text}
                    series={series}
                    current={current}
                    period={period}
                    setPeriod={setPeriod}
                />
                <ExpenseBreakdownCard
                    text={text}
                    categoryTotals={categoryTotals}
                    categoryLabels={categoryLabels}
                    totalExpenses={current.expenses}
                />
            </section>
        </>
    );
}

function FinanceTrendCard({
    text,
    series,
    current,
    period,
    setPeriod,
}: {
    text: Record<string, string>;
    series: FinanceSeriesPoint[];
    current: FinancePeriodSummary;
    period: FinancePeriod;
    setPeriod: (period: FinancePeriod) => void;
}) {
    const totals = [
        { label: text.revenue, value: current.revenue, color: FINANCE_LINES[0].color },
        { label: text.expenses, value: current.expenses, color: FINANCE_LINES[1].color },
        {
            label: text.profit,
            value: current.profit,
            color: current.profit < 0 ? FINANCE_LINES[1].color : FINANCE_LINES[2].color,
        },
    ];

    return (
        <article className="billing-surface relative overflow-hidden rounded-[22px] p-4">
            <div className="relative z-10 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div>
                    <div className="flex items-center gap-3">
                        <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-[var(--bg-tertiary)] text-accent">
                            <Activity className="h-3.5 w-3.5" aria-hidden="true" />
                        </span>
                        <div>
                            <h2 className="text-base font-semibold text-[var(--text-main)]">{text.trend_title}</h2>
                            <p className="text-xs text-[var(--text-muted)]">{text.trend_subtitle}</p>
                        </div>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-3">
                        {totals.map((item) => (
                            <FinanceTotal
                                key={item.label}
                                label={item.label}
                                value={item.value}
                                color={item.color}
                            />
                        ))}
                    </div>
                </div>
                <div
                    className="flex rounded-full bg-[var(--bg-tertiary)] p-1"
                    role="group"
                    aria-label={text.trend_title}
                >
                    {PERIODS.map((item) => (
                        <Button variant="custom"
                            key={item}
                            type="button"
                            onClick={() => setPeriod(item)}
                            aria-pressed={period === item}
                            className={`h-8 min-w-10 rounded-full px-3 text-xs font-semibold transition ${
                                period === item
                                    ? "bg-[var(--btn-primary-bg)] text-[var(--btn-primary-text)]"
                                    : "text-[var(--text-muted)] hover:text-[var(--text-main)]"
                            }`}
                        >
                            {text[`period_${item}`]}
                        </Button>
                    ))}
                </div>
            </div>

            {/* Chart plot background stays on InteractiveLineChart for line contrast. */}
            <FinanceLineChart series={series} text={text} />
        </article>
    );
}

function FinanceLineChart({
    series,
    text,
}: {
    series: FinanceSeriesPoint[];
    text: Record<string, string>;
}) {
    const latestProfit = series[series.length - 1]?.profit ?? 0;
    return (
        <InteractiveLineChart
            labels={series.map((point) => point.label)}
            emptyLabel={text.empty_monthly}
            yFormatter={formatCompactCurrency}
            series={FINANCE_LINES.map((line) => ({
                id: line.key,
                label: text[line.labelKey],
                color: line.key === "profit" && latestProfit < 0
                    ? FINANCE_LINES[1].color
                    : line.color,
                strokeOpacity: line.strokeOpacity,
                values: series.map((point) => getPointValue(point, line.key)),
                valueFormatter: formatCurrency,
            }))}
        />
    );
}

function ExpenseBreakdownCard({
    text,
    categoryTotals,
    categoryLabels,
    totalExpenses,
}: {
    text: Record<string, string>;
    categoryTotals: Array<{ category: string; total: number }>;
    categoryLabels: Record<string, string>;
    totalExpenses: number;
}) {
    return (
        <article className="billing-surface rounded-[22px] p-4">
            <div className="mb-4 flex items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--bg-tertiary)] text-accent">
                    <PieChart className="h-4 w-4" aria-hidden="true" />
                </span>
                <div>
                    <h2 className="text-base font-semibold text-[var(--text-main)]">{text.categories_title}</h2>
                    <p className="text-xs text-[var(--text-muted)]">{text.categories_subtitle}</p>
                </div>
            </div>

            <div className="space-y-2.5">
                {categoryTotals.map((item) => {
                    const percent = totalExpenses > 0 ? Math.round((item.total / totalExpenses) * 100) : 0;
                    return (
                        <div key={item.category} className="billing-block rounded-2xl p-3">
                            <div className="mb-2 flex items-center justify-between gap-3 text-sm">
                                <span className="font-semibold text-[var(--text-main)]">
                                    {categoryLabels[item.category] || item.category}
                                </span>
                                <span className="font-semibold text-[var(--text-main)]">{formatCurrency(item.total)}</span>
                            </div>
                            <div className="flex items-center gap-3">
                                <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-[var(--bg-card-solid)]">
                                    <div className="h-full rounded-full bg-accent/55" style={{ width: `${percent}%` }} />
                                </div>
                                <span className="w-10 text-right text-xs font-semibold text-[var(--text-muted)]">{percent}%</span>
                            </div>
                        </div>
                    );
                })}
                {categoryTotals.length === 0 && (
                    <div className="billing-block rounded-2xl p-6 text-center text-sm text-[var(--text-muted)]">
                        {text.empty_categories}
                    </div>
                )}
            </div>
        </article>
    );
}

function ClientProfitabilityDashboard({
    text,
    data,
    loading,
    errorKind,
    onRetry,
    period,
    setPeriod,
}: {
    text: Record<string, string>;
    data: ClientProfitability | null;
    loading: boolean;
    errorKind: ReadErrorKind | null;
    onRetry: () => void;
    period: ClientProfitabilityPeriod;
    setPeriod: (period: ClientProfitabilityPeriod) => void;
}) {
    const errorMessage = getReadRecoveryMessage(errorKind, {
        unavailable: text.profitability_error_load,
        denied: text.profitability_error_denied,
    });
    const current = data?.current;
    const previous = data?.previous;
    const hasUnassignedMaterial = Boolean(
        current
        && previous
        && (current.unassigned_material_cost_base_amount > 0
            || previous.unassigned_material_cost_base_amount > 0),
    );
    const metrics = current && previous
        ? [
            {
                label: text.profitability_revenue,
                value: current.revenue_base_amount,
                previous: previous.revenue_base_amount,
                icon: ReceiptText,
                comparisonDirection: "higher" as const,
            },
            {
                label: text.profitability_direct_costs,
                value: current.direct_cost_base_amount,
                previous: previous.direct_cost_base_amount,
                icon: ArrowDownRight,
                comparisonDirection: "lower" as const,
            },
            {
                label: text.profitability_known_margin,
                value: current.known_margin_amount,
                previous: previous.known_margin_amount,
                icon: BarChart3,
                comparisonDirection: "higher" as const,
            },
            {
                label: text.profitability_unassigned_expenses,
                value: current.unassigned_expense_base_amount,
                previous: previous.unassigned_expense_base_amount,
                icon: Inbox,
                comparisonDirection: "lower" as const,
            },
            ...(hasUnassignedMaterial ? [{
                label: text.profitability_unassigned_material,
                value: current.unassigned_material_cost_base_amount,
                previous: previous.unassigned_material_cost_base_amount,
                icon: Package,
                comparisonDirection: "lower" as const,
            }] : []),
        ]
        : [];
    const columns: DataListColumn[] = [
        { key: "client", label: text.profitability_client },
        { key: "invoices", label: text.profitability_invoices, className: "text-right" },
        { key: "costs", label: text.profitability_costs, className: "text-right" },
        { key: "margin", label: text.profitability_margin, className: "text-right" },
        { key: "percentage", label: text.profitability_margin_percent, className: "text-right" },
    ];

    return (
        <>
            <section className="billing-surface rounded-[22px] p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex items-center gap-3">
                        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--bg-tertiary)] text-accent">
                            <UsersRound className="h-4 w-4" aria-hidden="true" />
                        </span>
                        <div>
                            <h2 className="text-base font-semibold text-[var(--text-main)]">{text.profitability_title}</h2>
                            <p className="text-xs text-[var(--text-muted)]">{text.profitability_subtitle}</p>
                        </div>
                    </div>
                    <div
                        className="flex w-fit rounded-full bg-[var(--bg-tertiary)] p-1"
                        role="group"
                        aria-label={text.profitability_title}
                    >
                        {(["month", "year"] as const).map((item) => (
                            <Button variant="custom"
                                key={item}
                                type="button"
                                onClick={() => setPeriod(item)}
                                aria-pressed={period === item}
                                className={`h-8 rounded-full px-3 text-xs font-semibold transition ${
                                    period === item
                                        ? "bg-[var(--btn-primary-bg)] text-[var(--btn-primary-text)]"
                                        : "text-[var(--text-muted)] hover:text-[var(--text-main)]"
                                }`}
                            >
                                {item === "month" ? text.profitability_period_month : text.profitability_period_year}
                            </Button>
                        ))}
                    </div>
                </div>
            </section>

            {errorKind && errorMessage ? (
                <ReadRecoveryBanner
                    kind={errorKind}
                    message={errorMessage}
                    retryLabel={text.retry}
                    onRetry={shouldShowReadRetry(errorKind) ? onRetry : undefined}
                    retrying={loading}
                />
            ) : null}

            {loading && !data ? (
                <div className="billing-surface flex items-center justify-center gap-3 rounded-[28px] py-20 text-sm font-semibold text-[var(--text-muted)]">
                    <Loader2 className="h-5 w-5 animate-spin text-accent" />
                    {text.loading}
                </div>
            ) : null}

            {!loading && !data && !errorKind ? (
                <div className="billing-surface rounded-[28px] p-8 text-center text-sm text-[var(--text-muted)]">
                    {text.profitability_empty}
                </div>
            ) : null}

            {current ? (
                <>
                    <SummaryMetricGrid desktopColumns={hasUnassignedMaterial ? 5 : 4} className="gap-2.5">
                        {metrics.map(({ label, value, previous: previousValue, icon, comparisonDirection }) => {
                            const change = getPercentageChange(value, previousValue);
                            return <SummaryMetricCard key={label} label={label} value={formatCurrency(value)} icon={icon} trend={change === null ? undefined : { value: change, comparisonDirection }} />;
                        })}
                    </SummaryMetricGrid>

                    <DataListTable
                        items={current.clients}
                        getRowKey={(item) => item.client_id}
                        columns={columns}
                        header={{
                            title: text.profitability_table_title,
                            subtitle: text.profitability_table_subtitle,
                            countLabel: text.profitability_clients.replace("{count}", String(current.client_count)),
                        }}
                        renderCompactRow={(item) => (
                            <div className="space-y-2">
                                <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0">
                                        <p className="truncate text-sm font-semibold text-[var(--text-main)]">{item.client_name}</p>
                                        <p className="mt-0.5 text-xs text-[var(--text-muted)]">
                                            {item.invoice_count} {text.profitability_invoices.toLowerCase()}
                                        </p>
                                    </div>
                                    <span className="shrink-0 text-sm font-semibold text-[var(--text-main)]">
                                        {formatCurrency(item.known_margin_amount)}
                                    </span>
                                </div>
                                <div className="flex items-center justify-between gap-3 text-xs text-[var(--text-muted)]">
                                    <span>{text.profitability_costs}: {formatCurrency(item.direct_cost_base_amount)}</span>
                                    <span>{formatMarginPercentage(item.known_margin_percentage)}</span>
                                </div>
                            </div>
                        )}
                        renderDesktopRow={(item) => (
                            <>
                                <span className="truncate text-sm font-semibold text-[var(--text-main)]">{item.client_name}</span>
                                <span className="text-right text-sm text-[var(--text-muted)]">{item.invoice_count}</span>
                                <span className="text-right text-sm text-[var(--text-muted)]">{formatCurrency(item.direct_cost_base_amount)}</span>
                                <span className="text-right text-sm font-semibold text-[var(--text-main)]">{formatCurrency(item.known_margin_amount)}</span>
                                <span className="text-right text-sm text-[var(--text-muted)]">{formatMarginPercentage(item.known_margin_percentage)}</span>
                            </>
                        )}
                        empty={<p className="text-sm text-[var(--text-muted)]">{text.profitability_empty}</p>}
                    />

                    <section className="grid gap-3 lg:grid-cols-2">
                        <div className="billing-block rounded-2xl p-4">
                            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">{text.profitability_unassigned_expenses}</p>
                            <p className="mt-1 text-xl font-semibold text-[var(--text-main)]">{formatCurrency(current.unassigned_expense_base_amount)}</p>
                            <p className="mt-1 text-xs text-[var(--text-muted)]">{text.profitability_unassigned_expenses_desc}</p>
                        </div>
                        {current.unassigned_material_cost_base_amount > 0 ? (
                            <div className="billing-block rounded-2xl p-4">
                                <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">{text.profitability_unassigned_material}</p>
                                <p className="mt-1 text-xl font-semibold text-[var(--text-main)]">{formatCurrency(current.unassigned_material_cost_base_amount)}</p>
                                <p className="mt-1 text-xs text-[var(--text-muted)]">{text.profitability_unassigned_material_desc}</p>
                            </div>
                        ) : null}
                        {current.unlinked_historical_sales_base_amount > 0 ? (
                            <div className="billing-block rounded-2xl p-4 text-sm text-[var(--text-muted)]">
                                {text.profitability_history_notice.replace(
                                    "{amount}",
                                    formatCurrency(current.unlinked_historical_sales_base_amount),
                                )}
                            </div>
                        ) : null}
                    </section>
                </>
            ) : null}
        </>
    );
}

function OperationsDashboard({
    text,
    dict,
    loading,
    stats,
}: {
    text: Record<string, string>;
    dict: { analytics: Record<string, string> };
    loading: boolean;
    stats: TaskChartStats;
}) {
    if (loading) {
        return (
            <div className="billing-surface rounded-[28px] p-8 text-sm font-semibold text-[var(--text-muted)]">
                {text.loading}
            </div>
        );
    }

    const summary = [
        {
            label: dict.analytics.completed,
            value: stats.completed.reduce((sum, value) => sum + value, 0),
            icon: <CheckCircle2 className="h-4 w-4" />,
            color: "var(--accent-color)",
        },
        {
            label: dict.analytics.pending,
            value: stats.pending.reduce((sum, value) => sum + value, 0),
            icon: <Clock3 className="h-4 w-4" />,
            color: "var(--color-amber-500)",
        },
        {
            label: dict.analytics.requests,
            value: (stats.requested || []).reduce((sum, value) => sum + value, 0),
            icon: <Inbox className="h-4 w-4" />,
            color: "var(--accent-color)",
        },
        {
            label: dict.analytics.overdue_with_delay,
            value: stats.overdue.reduce((sum, value) => sum + value, 0),
            icon: <TriangleAlert className="h-4 w-4" />,
            color: "var(--btn-cancel-hover-bg)",
        },
    ];

    return (
        <section className="grid gap-4 xl:grid-cols-[minmax(0,1.55fr)_minmax(20rem,0.62fr)]">
            <article className="billing-surface rounded-[22px] p-4">
                <div className="mb-4 flex items-center gap-3">
                    <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-[var(--bg-tertiary)] text-accent">
                        <BarChart3 className="h-3.5 w-3.5" aria-hidden="true" />
                    </span>
                    <div>
                        <h2 className="text-base font-semibold text-[var(--text-main)]">{dict.analytics.services_flow_title}</h2>
                        <p className="text-xs text-[var(--text-muted)]">{dict.analytics.services_flow_subtitle}</p>
                    </div>
                </div>
                {/* Chart plot background stays on InteractiveLineChart for line contrast. */}
                <OperationsLineChart stats={stats} dict={dict} />
            </article>

            <article className="billing-surface rounded-[22px] p-4">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-accent">{dict.analytics.services_flow_badge}</p>
                <h2 className="mt-1 text-base font-semibold text-[var(--text-main)]">{dict.analytics.ops_inspection}</h2>
                <div className="mt-4 grid grid-cols-2 gap-3">
                    {summary.map((item) => (
                        <div key={item.label} className="billing-block rounded-2xl p-3">
                            <span
                                className="flex h-8 w-8 items-center justify-center rounded-xl bg-[var(--bg-card-solid)]"
                                style={{ color: item.color }}
                                aria-hidden="true"
                            >
                                {item.icon}
                            </span>
                            <p className="mt-3 text-xl font-semibold text-[var(--text-main)]">{item.value}</p>
                            <p className="mt-1 text-[10px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">{item.label}</p>
                        </div>
                    ))}
                </div>
            </article>
        </section>
    );
}

function OperationsLineChart({
    stats,
    dict,
}: {
    stats: TaskChartStats;
    dict: { analytics: Record<string, string> };
}) {
    const lines = [
        { label: dict.analytics.completed, data: stats.completed, color: "var(--accent-color)" },
        { label: dict.analytics.pending, data: stats.pending, color: "var(--color-amber-500)" },
        { label: dict.analytics.requests, data: stats.requested || [], color: "var(--accent-color)" },
    ];
    return (
        <InteractiveLineChart
            labels={stats.labels}
            emptyLabel={dict.analytics.services_flow_empty_title}
            yFormatter={(value) => `${Math.round(value)}`}
            includeZero
            series={lines.map((line) => ({
                id: line.label,
                label: line.label,
                color: line.color,
                values: stats.labels.map((_, index) => line.data[index] || 0),
                valueFormatter: (value) => `${Math.round(value)}`,
            }))}
        />
    );
}

function FinanceTotal({
    label,
    value,
    color,
}: {
    label: string;
    value: number;
    color: string;
}) {
    return (
        <span className="billing-block inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold text-[var(--text-muted)]">
            <span className="h-2 w-2 rounded-full" style={{ background: color }} aria-hidden="true" />
            <span>{label}</span>
            <span className="text-[var(--text-main)]">{formatCurrency(value)}</span>
        </span>
    );
}

function getPointValue(point: FinanceSeriesPoint, key: (typeof FINANCE_LINES)[number]["key"]) {
    return point[key];
}

function formatMarginPercentage(value: number | null) {
    return value === null ? "—" : `${value.toFixed(1)}%`;
}

function formatCompactCurrency(value: number) {
    const abs = Math.abs(value);
    const sign = value < 0 ? "-" : "";
    if (abs >= 1000000) return `${sign}${(abs / 1000000).toFixed(1)}M`;
    if (abs >= 1000) return `${sign}${(abs / 1000).toFixed(0)}k`;
    return `${sign}${Math.round(abs)}`;
}
