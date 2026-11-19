"use client";

import {
    useCallback,
    useEffect,
    useMemo,
    useState,
} from "react";
import { redirect } from "next/navigation";
import Link from "next/link";
import {
    Activity,
    ArrowDownRight,
    BarChart3,
    CheckCircle2,
    Clock3,
    Download,
    Inbox,
    Loader2,
    ReceiptText,
    TriangleAlert,
    UsersRound,
} from "lucide-react";

import { canManageFinance, canViewFinance, canViewLaborCosts, canViewWorkReports, isExternalPortalRole, isPlatformSuperadmin } from "@/domain/access/roles";
import { PageHeader } from "@/components/ui/page-header";
import { PremiumTabs } from "@/components/ui/premium-tabs";
import {
    buildFinanceSeries,
    groupExpensesByCategory,
    manualSalesLedgerEntriesWithoutWorkHiveInvoices,
    summarizeFinancePeriod,
    manualSalesLedgerToFinanceRevenue,
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
import { ExpenseService } from "@/services/expense.service";
import { InvoiceService } from "@/services/invoice.service";
import { SalesLedgerService } from "@/services/sales-ledger.service";
import { collectPaginated } from "@/lib/pagination";
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
import { FinanceMetricButton } from "@/components/finance/FinanceMetricButton";
import { FinanceLoadError } from "@/components/finance/FinanceLoadError";
import { FinanceAnalysisSources, type FinanceSourceScope } from "@/components/analytics/FinanceAnalysisSources";
import { financeChange } from "@/lib/finance-workspace";
import { financeLocalDay } from "@/lib/finance-priorities";
import { useViewState } from "@/hooks/useViewState";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CompanyPlanAccessService } from "@/services/company-plan-access.service";
import { CustomerPaymentService } from "@/services/customer-payment.service";
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
    const canViewOperations = canViewWorkReports(user) && !isExternalPortalRole(user?.role?.name);
    const isAccountant = isExternalPortalRole(user?.role?.name);
    const text = dict.finance_analytics;
    const profileCharts = useProfile();

    const [activeTab, setActiveTab] = useViewState<AnalyticsTab>("analytics.tab", "finance");
    const [period, setPeriod] = useViewState<FinancePeriod>("analytics.period", "month");
    const [revenueRecords, setRevenueRecords] = useState<FinanceRevenueRecord[]>([]);
    const [expenses, setExpenses] = useState<Expense[]>([]);
    const [payments, setPayments] = useState<FinancePaymentRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState(false);
    const [exportYear, setExportYear] = useState(() => new Date().getFullYear());
    const [exportPeriod, setExportPeriod] = useState<AccountantExportPeriod>("month");
    const [exportPeriodNumber, setExportPeriodNumber] = useState(() => new Date().getMonth() + 1);
    const [exportingAccountantPackage, setExportingAccountantPackage] = useState(false);
    const [profitabilityPeriod, setProfitabilityPeriod] = useState<ClientProfitabilityPeriod>("month");
    const [profitability, setProfitability] = useState<ClientProfitability | null>(null);
    const [profitabilityLoading, setProfitabilityLoading] = useState(false);
    const [enabledFeatures, setEnabledFeatures] = useState<Set<string> | null>(null);
    const [marginContracts, setMarginContracts] = useState<ServiceContract[]>([]);
    const [marginWorkOrders, setMarginWorkOrders] = useState<WorkOrder[]>([]);
    const [marginLocations, setMarginLocations] = useState<Location[]>([]);
    const [marginServices, setMarginServices] = useState<ServiceMarginScope[]>([]);
    const [marginTeamLaborCosts, setMarginTeamLaborCosts] = useState<TeamLaborCost[]>([]);
    const [marginCatalogsLoading, setMarginCatalogsLoading] = useState(false);

    useEffect(() => {
        if (userLoading || isPlatformSuperadmin(user) || !user?.company_id) return;
        let cancelled = false;
        void CompanyPlanAccessService.getCurrentEntitlements()
            .then((access) => {
                if (cancelled) return;
                const nextEnabledFeatures = new Set<string>();
                access.entitlements.forEach((entitlement) => {
                    if (entitlement.value_type === "boolean" && entitlement.value === true) {
                        nextEnabledFeatures.add(entitlement.code);
                    }
                });
                setEnabledFeatures(nextEnabledFeatures);
            })
            .catch(() => {
                if (!cancelled) setEnabledFeatures(null);
            });
        return () => {
            cancelled = true;
        };
    }, [user, userLoading]);

    const companyFeatures = userLoading || isPlatformSuperadmin(user) || !user?.company_id
        ? null
        : enabledFeatures;
    const canViewProfitability = companyFeatures?.has("features.profitability") ?? false;
    const canDownloadAccountantPackage = companyFeatures?.has("features.accountant_portal") ?? false;

    const loadAnalytics = useCallback(async () => {
        if (!canViewAnalytics) return;
        try {
            setLoading(true);
            setLoadError(false);
            const [invoiceData, expenseData, salesLedgerEntries, customerPayments] = await Promise.all([
                InvoiceService.getAllInvoices(),
                ExpenseService.getAllExpenses(),
                collectPaginated((skip, limit) => SalesLedgerService.getEntries({ skip, limit })),
                CustomerPaymentService.getPayments(),
            ]);
            setRevenueRecords([
                ...invoiceData,
                ...manualSalesLedgerEntriesWithoutWorkHiveInvoices(
                    salesLedgerEntries.filter((entry) => entry.source_type === "manual"),
                    invoiceData,
                )
                    .map(manualSalesLedgerToFinanceRevenue),
            ]);
            setExpenses(expenseData);
            setPayments(customerPayments);
        } catch (error) {
            setLoadError(true);
            console.error("Error loading finance analytics", error);
            toast.error(text.error_load);
        } finally {
            setLoading(false);
        }
    }, [canViewAnalytics, text.error_load]);

    const loadProfitability = useCallback(async () => {
        if (!canViewAnalytics || !canViewProfitability) return;
        try {
            setProfitabilityLoading(true);
            setProfitability(await ClientProfitabilityService.getProfitability(profitabilityPeriod));
        } catch (error) {
            console.error("Error loading client profitability", error);
            toast.error(text.profitability_error_load);
        } finally {
            setProfitabilityLoading(false);
        }
    }, [canViewAnalytics, canViewProfitability, profitabilityPeriod, text.profitability_error_load]);

    const loadOperationalMarginCatalogs = useCallback(async () => {
        if (!canViewOperationalMargin || !canViewProfitability) return;
        try {
            setMarginCatalogsLoading(true);
            const [contractsResult, workOrdersResult, locationsResult, servicesResult, teamCostsResult] = await Promise.allSettled([
                ServiceContractService.getContracts(),
                WorkOrderService.getWorkOrders(),
                LocationService.getLocations(),
                ServiceMarginService.getScopes(),
                TeamLaborCostService.getSummaries(),
            ]);
            if (contractsResult.status === "rejected") throw contractsResult.reason;
            if (workOrdersResult.status === "rejected") throw workOrdersResult.reason;
            if (locationsResult.status === "rejected") throw locationsResult.reason;
            if (servicesResult.status === "rejected") throw servicesResult.reason;
            if (teamCostsResult.status === "rejected") throw teamCostsResult.reason;
            setMarginContracts(contractsResult.value);
            setMarginWorkOrders(workOrdersResult.value);
            setMarginLocations(locationsResult.value);
            setMarginServices(servicesResult.value);
            setMarginTeamLaborCosts(teamCostsResult.value);
        } catch (error) {
            console.error("Error loading operational margin catalogs", error);
            toast.error(text.operational_margin_error_load);
        } finally {
            setMarginCatalogsLoading(false);
        }
    }, [canViewOperationalMargin, canViewProfitability, text.operational_margin_error_load]);

    useEffect(() => {
        if (userLoading) return;
        const timer = window.setTimeout(() => {
            void loadAnalytics();
        }, 0);
        return () => window.clearTimeout(timer);
    }, [loadAnalytics, userLoading]);

    useEffect(() => {
        if (userLoading || !canViewProfitability || activeTab !== "profitability") return;
        const timer = window.setTimeout(() => {
            void loadProfitability();
        }, 0);
        return () => window.clearTimeout(timer);
    }, [activeTab, canViewProfitability, loadProfitability, userLoading]);

    useEffect(() => {
        if (userLoading || activeTab !== "operational_margin") return;
        const timer = window.setTimeout(() => {
            void loadOperationalMarginCatalogs();
        }, 0);
        return () => window.clearTimeout(timer);
    }, [activeTab, loadOperationalMarginCatalogs, userLoading]);

    useEffect(() => {
        if (
            (!canViewProfitability && activeTab === "profitability")
            || (!(canViewProfitability && canViewOperationalMargin) && activeTab === "operational_margin")
            || (!canViewOperations && activeTab === "operations")
        ) {
            const timer = window.setTimeout(() => setActiveTab("finance"), 0);
            return () => window.clearTimeout(timer);
        }
    }, [activeTab, canViewOperationalMargin, canViewProfitability, setActiveTab, canViewOperations]);

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

    if (!userLoading && !canViewAnalytics) redirect("/dashboard");

    if (userLoading || loading) {
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
                                    ...(canViewOperations ? [{ id: "operations" as const, label: text.tab_operations }] : []),
                                ]}
                            activeTab={activeTab}
                            onChange={setActiveTab}
                            className="w-full sm:min-w-72"
                        />
                    )}
                />

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

                {activeTab === "finance" && loadError ? <FinanceLoadError message="No se han podido cargar todos los movimientos financieros. Los importes no están disponibles." onRetry={() => void loadAnalytics()} /> : activeTab === "finance" ? (
                    <FinanceDashboard
                        text={text}
                        series={series}
                        comparison={comparison}
                        categoryTotals={categoryTotals}
                        categoryLabels={dict.expenses.categories}
                        revenueRecords={revenueRecords}
                        expenses={expenses}
                        payments={payments}
                        period={period}
                        setPeriod={setPeriod}
                    />
                ) : activeTab === "profitability" ? (
                    <ClientProfitabilityDashboard
                        text={text}
                        data={profitability}
                        loading={profitabilityLoading}
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
                        canManage={canManageAnalytics}
                        copy={text}
                    />
                ) : activeTab === "reconciliation" ? (
                    <BankReconciliationSection copy={text} canManage={canManageAnalytics} />
                ) : profileCharts.error ? <FinanceLoadError message="La actividad operativa no está disponible. Vuelve a consultar el origen para ver sus cifras." onRetry={() => void profileCharts.loadProfileData()} /> : (
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

function FinanceDashboard({ text, series, comparison, categoryTotals, categoryLabels, period, setPeriod, revenueRecords, expenses, payments }: {
 text: Record<string, string>; series: FinanceSeriesPoint[];
 comparison: { current: FinancePeriodSummary; previous: FinancePeriodSummary };
 categoryTotals: Array<{ category: string; total: number }>; categoryLabels: Record<string, string>;
 period: FinancePeriod; setPeriod: (period: FinancePeriod) => void;
 revenueRecords: FinanceRevenueRecord[]; expenses: Expense[]; payments: FinancePaymentRecord[];
}) {
 const { current, previous } = comparison;
 const [source, setSource] = useState<FinanceSourceScope>("revenue");
 const [category, setCategory] = useState("");
 const metrics = [
  { key: "revenue" as const, label: text.revenue, value: current.revenue, previous: previous.revenue, icon: ReceiptText, description: "Emisión · base sin impuestos" },
  { key: "payments" as const, label: text.paid_collected, value: current.paid, previous: previous.paid, icon: CheckCircle2, description: "Recepción de cobros · con impuestos" },
  { key: "expenses" as const, label: text.expenses, value: current.expenses, previous: previous.expenses, icon: ArrowDownRight, description: "Registro de gastos · base sin impuestos" },
  { key: "balance" as const, label: "Saldo de ingresos y gastos", value: current.profit, previous: previous.profit, icon: BarChart3, description: "Importes registrados · cobertura de costes parcial" },
 ];
 return <>
 <section className="billing-surface rounded-xl p-3"><div className="flex flex-wrap items-center justify-between gap-2"><h2 className="text-sm font-semibold">Periodo de actividad</h2><p className="text-xs text-muted-foreground">EUR · Hasta {financeLocalDay(new Date())} · Comparación con los mismos días previos</p></div><PremiumTabs tabs={PERIODS.map(item => ({ id: item, label: text[`period_${item}`] }))} activeTab={period} onChange={setPeriod} className="mb-0 mt-2" /></section>
 <SummaryMetricGrid desktopColumns={4}>{metrics.map(metric => {
  const change = financeChange(metric.value, metric.previous);
  const comparisonLabel = change.kind === "absolute" ? `${formatCurrency(change.value)} frente al periodo comparable` : `${change.value > 0 ? "+" : ""}${change.value.toFixed(1)}% frente al periodo comparable`;
  return <FinanceMetricButton key={metric.key} label={metric.label} value={formatCurrency(metric.value)} description={`${metric.description} · ${comparisonLabel}`} icon={metric.icon} active={source === metric.key && !category} onClick={() => { setSource(metric.key); setCategory(""); }} />;
 })}</SummaryMetricGrid>
 {revenueRecords.some(record => record.source_type === "manual") && <p role="status" className="rounded-xl border border-orange-400/40 bg-orange-400/5 p-3 text-xs">Cobros con datos parciales: las ventas históricas sin fecha de recepción se incluyen en ingresos, pero no se asignan a un periodo de cobro. Consulta sus estados en el Libro de ventas.</p>}
 <p className="text-xs text-muted-foreground">El saldo de ingresos y gastos no incorpora costes todavía sin registrar ni permite deducir un beneficio neto. <Link href="/dashboard/invoice-summary" className="text-accent hover:underline">Ver saldo pendiente y vencido a fecha actual</Link>.</p>
 <section className="grid gap-4 xl:grid-cols-[minmax(0,1.55fr)_minmax(20rem,0.62fr)]"><FinanceTrendCard text={text} series={series} current={current} period={period} setPeriod={setPeriod}/><section className="billing-surface rounded-xl p-4"><h2 className="text-sm font-semibold">Gastos por categoría</h2><p className="mt-1 text-xs text-muted-foreground">Base sin impuestos · pulsa para consultar el origen.</p><div className="mt-3 space-y-2">{categoryTotals.map(item => <Button key={item.category} type="button" variant="outline" className="h-auto w-full justify-between gap-3 p-3" onClick={() => { setSource("expenses"); setCategory(item.category); }}><span className="text-xs">{categoryLabels[item.category] || item.category}</span><strong className="text-xs tabular-nums">{formatCurrency(item.total)}</strong></Button>)}{!categoryTotals.length && <p className="py-5 text-xs text-muted-foreground">Sin gastos en este periodo.</p>}</div></section></section>
 <FinanceAnalysisSources revenue={revenueRecords} expenses={expenses} payments={payments} period={period} scope={source} category={category} onClearCategory={() => setCategory("")}/>
 </>;
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
                        <button
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
                        </button>
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

function ClientProfitabilityDashboard({
    text,
    data,
    loading,
    period,
    setPeriod,
}: {
    text: Record<string, string>;
    data: ClientProfitability | null;
    loading: boolean;
    period: ClientProfitabilityPeriod;
    setPeriod: (period: ClientProfitabilityPeriod) => void;
}) {
    if (loading && !data) {
        return (
            <div className="billing-surface flex items-center justify-center gap-3 rounded-[28px] py-20 text-sm font-semibold text-[var(--text-muted)]">
                <Loader2 className="h-5 w-5 animate-spin text-accent" />
                {text.loading}
            </div>
        );
    }

    if (!data) {
        return (
            <div className="billing-surface rounded-[28px] p-8 text-center text-sm text-[var(--text-muted)]">
                {text.profitability_empty}
            </div>
        );
    }

    const { current, previous } = data;

    const metrics = [
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
    ];
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
                            <button
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
                            </button>
                        ))}
                    </div>
                </div>
            </section>

            {data ? (
                <>
                    <SummaryMetricGrid desktopColumns={3} className="gap-2.5">
                        {metrics.map(({ label, value, previous: previousValue, icon, comparisonDirection }) => {
                            const change = getPercentageChange(value, previousValue);
                            return <SummaryMetricCard key={label} label={label} value={formatCurrency(value)} icon={icon} trend={change === null ? undefined : { value: change, comparisonDirection }} />;
                        })}
                    </SummaryMetricGrid>

                    <p role="status" className="rounded-xl border border-orange-400/30 bg-orange-400/5 p-3 text-xs">Cobertura de costes: parcial, sin porcentaje verificable. Se muestran costes directos registrados. Gastos sin imputar: {formatCurrency(current.unassigned_expense_base_amount)} · Material sin imputar: {formatCurrency(current.unassigned_material_cost_base_amount)} · Ventas históricas sin cliente: {formatCurrency(current.unlinked_historical_sales_base_amount)}.</p>
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
