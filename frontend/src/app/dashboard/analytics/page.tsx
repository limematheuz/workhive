"use client";

import {
    useCallback,
    useEffect,
    useMemo,
    useState,
} from "react";
import {
    Activity,
    ArrowDownRight,
    BarChart3,
    CheckCircle2,
    Clock3,
    Download,
    Inbox,
    Loader2,
    PieChart,
    ReceiptText,
    TriangleAlert,
    UsersRound,
} from "lucide-react";

import { canViewFinance, isAccountantRole, isPlatformSuperadmin } from "@/domain/access/roles";
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
import { SummaryMetricCard } from "@/components/ui/summary-metric-card";

type AnalyticsTab = "finance" | "profitability" | "operations";

const PERIODS: FinancePeriod[] = ["day", "week", "month", "year"];

const FINANCE_LINES = [
    { key: "revenue", color: "#047857", labelKey: "revenue", strokeOpacity: 0.82 },
    { key: "expenses", color: "var(--btn-cancel-hover-bg)", labelKey: "expenses", strokeOpacity: 0.98 },
    { key: "profit", color: "var(--brand-blue-bright)", labelKey: "profit", strokeOpacity: 0.98 },
] as const;

export default function FinanceAnalyticsPage() {
    const { dict, locale } = useDictionary();
    const { user, loading: userLoading } = useUser();
    const canViewAnalytics = canViewFinance(user) && !isPlatformSuperadmin(user);
    const isAccountant = isAccountantRole(user?.role?.name);
    const text = dict.finance_analytics;
    const profileCharts = useProfile();

    const [activeTab, setActiveTab] = useState<AnalyticsTab>("finance");
    const [period, setPeriod] = useState<FinancePeriod>("month");
    const [revenueRecords, setRevenueRecords] = useState<FinanceRevenueRecord[]>([]);
    const [expenses, setExpenses] = useState<Expense[]>([]);
    const [loading, setLoading] = useState(true);
    const [exportYear, setExportYear] = useState(() => new Date().getFullYear());
    const [exportPeriod, setExportPeriod] = useState<AccountantExportPeriod>("month");
    const [exportPeriodNumber, setExportPeriodNumber] = useState(() => new Date().getMonth() + 1);
    const [exportingAccountantPackage, setExportingAccountantPackage] = useState(false);
    const [profitabilityPeriod, setProfitabilityPeriod] = useState<ClientProfitabilityPeriod>("month");
    const [profitability, setProfitability] = useState<ClientProfitability | null>(null);
    const [profitabilityLoading, setProfitabilityLoading] = useState(false);

    const loadAnalytics = useCallback(async () => {
        if (!canViewAnalytics) return;
        try {
            setLoading(true);
            const [invoiceData, expenseData, salesLedgerEntries] = await Promise.all([
                InvoiceService.getAllInvoices(),
                ExpenseService.getAllExpenses(),
                collectPaginated((skip, limit) => SalesLedgerService.getEntries({ skip, limit })),
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
        } catch (error) {
            console.error("Error loading finance analytics", error);
            toast.error(text.error_load);
        } finally {
            setLoading(false);
        }
    }, [canViewAnalytics, text.error_load]);

    const loadProfitability = useCallback(async () => {
        if (!canViewAnalytics) return;
        try {
            setProfitabilityLoading(true);
            setProfitability(await ClientProfitabilityService.getProfitability(profitabilityPeriod));
        } catch (error) {
            console.error("Error loading client profitability", error);
            toast.error(text.profitability_error_load);
        } finally {
            setProfitabilityLoading(false);
        }
    }, [canViewAnalytics, profitabilityPeriod, text.profitability_error_load]);

    useEffect(() => {
        if (userLoading) return;
        const timer = window.setTimeout(() => {
            void loadAnalytics();
        }, 0);
        return () => window.clearTimeout(timer);
    }, [loadAnalytics, userLoading]);

    useEffect(() => {
        if (userLoading || activeTab !== "profitability") return;
        const timer = window.setTimeout(() => {
            void loadProfitability();
        }, 0);
        return () => window.clearTimeout(timer);
    }, [activeTab, loadProfitability, userLoading]);

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
        () => buildFinanceSeries(revenueRecords, expenses, locale, period),
        [expenses, revenueRecords, locale, period],
    );
    const comparison = useMemo(
        () => summarizeFinancePeriod(revenueRecords, expenses, period),
        [expenses, revenueRecords, period],
    );
    const categoryTotals = useMemo(
        () => groupExpensesByCategory(expenses, period),
        [expenses, period],
    );

    if (userLoading || loading) {
        return (
            <div className="flex h-full items-center justify-center gap-3 text-[var(--text-muted)]">
                <Loader2 className="h-5 w-5 animate-spin text-accent" />
                <span className="text-sm font-semibold">{text.loading}</span>
            </div>
        );
    }

    if (!canViewAnalytics) {
        return (
            <div className="mx-auto max-w-3xl rounded-2xl border border-[var(--border-soft)] bg-[var(--bg-card-solid)] p-6">
                <p className="text-lg font-black text-[var(--text-main)]">{text.restricted_title}</p>
                <p className="mt-2 text-sm text-[var(--text-muted)]">{text.restricted_desc}</p>
            </div>
        );
    }

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
                                    { id: "profitability", label: text.tab_profitability },
                                    { id: "operations", label: text.tab_operations },
                                ]}
                            activeTab={activeTab}
                            onChange={setActiveTab}
                            className="w-full sm:min-w-72"
                        />
                    )}
                />

                {activeTab === "finance" ? (
                    <div className="flex flex-wrap items-center justify-end gap-2">
                        <label className="sr-only" htmlFor="accountant-export-year">
                            {text.accountant_export_year}
                        </label>
                        <select
                            id="accountant-export-year"
                            value={exportYear}
                            onChange={(event) => setExportYear(Number(event.target.value))}
                            className="h-10 rounded-xl border border-[var(--border-soft)] bg-[var(--bg-card-solid)] px-3 text-sm font-bold text-[var(--text-main)] shadow-sm outline-none focus:border-[var(--brand-blue-border)]"
                        >
                            {accountantExportYears(new Date().getFullYear()).map((year) => (
                                <option key={year} value={year}>{year}</option>
                            ))}
                        </select>
                        <select
                            aria-label={text.accountant_export_period}
                            value={exportPeriod}
                            onChange={(event) => {
                                const nextPeriod = event.target.value as AccountantExportPeriod;
                                setExportPeriod(nextPeriod);
                                setExportPeriodNumber(1);
                            }}
                            className="h-10 rounded-xl border border-[var(--border-soft)] bg-[var(--bg-card-solid)] px-3 text-sm font-bold text-[var(--text-main)] shadow-sm outline-none focus:border-[var(--brand-blue-border)]"
                        >
                            <option value="month">{text.accountant_export_month}</option>
                            <option value="quarter">{text.accountant_export_quarter}</option>
                            <option value="semester">{text.accountant_export_semester}</option>
                            <option value="year">{text.accountant_export_annual}</option>
                        </select>
                        {exportPeriod !== "year" ? (
                            <select
                                aria-label={text.accountant_export_period_number}
                                value={exportPeriodNumber}
                                onChange={(event) => setExportPeriodNumber(Number(event.target.value))}
                                className="h-10 rounded-xl border border-[var(--border-soft)] bg-[var(--bg-card-solid)] px-3 text-sm font-bold text-[var(--text-main)] shadow-sm outline-none focus:border-[var(--brand-blue-border)]"
                            >
                                {periodNumberOptions.map((periodNumber) => (
                                    <option key={periodNumber} value={periodNumber}>
                                        {exportPeriod === "month"
                                            ? accountantMonthFormatter.format(new Date(2026, periodNumber - 1, 1))
                                            : `${exportPeriod === "quarter" ? "T" : "S"}${periodNumber}`}
                                    </option>
                                ))}
                            </select>
                        ) : null}
                        <button
                            type="button"
                            onClick={() => void downloadAccountantPackage()}
                            disabled={exportingAccountantPackage}
                            className={PAGE_ACTION_BUTTON_PRIMARY}
                        >
                            {exportingAccountantPackage ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                            <span>{text.accountant_export}</span>
                        </button>
                    </div>
                ) : null}

                {activeTab === "finance" ? (
                    <FinanceDashboard
                        text={text}
                        series={series}
                        comparison={comparison}
                        categoryTotals={categoryTotals}
                        categoryLabels={dict.expenses.categories}
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
            <section className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 xl:grid-cols-6">
                {metricCards.map(({ label, value, previous, icon, comparisonDirection }) => {
                    const change = getPercentageChange(value, previous);
                    return <SummaryMetricCard key={label} label={label} value={formatCurrency(value)} icon={icon} trend={change === null ? undefined : { value: change, comparisonDirection }} />;
                })}
            </section>

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
        {
            label: text.profitability_unassigned_expenses,
            value: current.unassigned_expense_base_amount,
            previous: previous.unassigned_expense_base_amount,
            icon: Inbox,
            comparisonDirection: "lower" as const,
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
                    <section className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
                        {metrics.map(({ label, value, previous: previousValue, icon, comparisonDirection }) => {
                            const change = getPercentageChange(value, previousValue);
                            return <SummaryMetricCard key={label} label={label} value={formatCurrency(value)} icon={icon} trend={change === null ? undefined : { value: change, comparisonDirection }} />;
                        })}
                    </section>

                    <DataListTable
                        items={current.clients}
                        getRowKey={(item) => item.client_id}
                        columns={columns}
                        gridClassName="grid-cols-[minmax(11rem,1.35fr)_5rem_7rem_7rem_5rem]"
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
