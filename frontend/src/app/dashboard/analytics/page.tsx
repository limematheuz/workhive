"use client";

import {
    useCallback,
    useEffect,
    useMemo,
    useState,
    type ReactNode,
} from "react";
import {
    Activity,
    ArrowDownRight,
    ArrowUpRight,
    BarChart3,
    CheckCircle2,
    Clock3,
    Inbox,
    Loader2,
    Minus,
    PieChart,
    ReceiptText,
    TriangleAlert,
} from "lucide-react";

import { canAdministerCompany, isPlatformSuperadmin } from "@/domain/access/roles";
import {
    buildFinanceSeries,
    groupExpensesByCategory,
    summarizeFinancePeriod,
    type FinancePeriod,
    type FinancePeriodSummary,
    type FinanceSeriesPoint,
} from "@/lib/finance-analytics";
import { useDictionary } from "@/lib/dictionary-context";
import { formatCurrency } from "@/lib/format";
import { useUser } from "@/lib/user-context";
import { useProfile, type TaskChartStats } from "@/hooks/useProfile";
import { InteractiveLineChart } from "@/components/dashboard/InteractiveLineChart";
import { PremiumTabs } from "@/components/ui/premium-tabs";
import { ExpenseService } from "@/services/expense.service";
import { InvoiceService } from "@/services/invoice.service";
import type { Expense } from "@/types/expense";
import type { Invoice } from "@/types/invoice";
import { toast } from "@/lib/toast";

type AnalyticsTab = "finance" | "operations";

const PERIODS: FinancePeriod[] = ["day", "week", "month", "year"];

const FINANCE_LINES = [
    { key: "revenue", color: "var(--accent-color)", labelKey: "revenue" },
    { key: "expenses", color: "var(--btn-cancel-hover-bg)", labelKey: "expenses" },
    { key: "profit", color: "var(--color-green-400)", labelKey: "profit" },
] as const;

export default function FinanceAnalyticsPage() {
    const { dict, locale } = useDictionary();
    const { user, loading: userLoading } = useUser();
    const canViewAnalytics = canAdministerCompany(user) && !isPlatformSuperadmin(user);
    const text = dict.finance_analytics;
    const profileCharts = useProfile();

    const [activeTab, setActiveTab] = useState<AnalyticsTab>("finance");
    const [period, setPeriod] = useState<FinancePeriod>("month");
    const [invoices, setInvoices] = useState<Invoice[]>([]);
    const [expenses, setExpenses] = useState<Expense[]>([]);
    const [loading, setLoading] = useState(true);

    const loadAnalytics = useCallback(async () => {
        if (!canViewAnalytics) return;
        try {
            setLoading(true);
            const [invoiceData, expenseData] = await Promise.all([
                InvoiceService.getAllInvoices(),
                ExpenseService.getAllExpenses(),
            ]);
            setInvoices(invoiceData);
            setExpenses(expenseData);
        } catch (error) {
            console.error("Error loading finance analytics", error);
            toast.error(text.error_load);
        } finally {
            setLoading(false);
        }
    }, [canViewAnalytics, text.error_load]);

    useEffect(() => {
        if (userLoading) return;
        const timer = window.setTimeout(() => {
            void loadAnalytics();
        }, 0);
        return () => window.clearTimeout(timer);
    }, [loadAnalytics, userLoading]);

    const series = useMemo(
        () => buildFinanceSeries(invoices, expenses, locale, period),
        [expenses, invoices, locale, period],
    );
    const comparison = useMemo(
        () => summarizeFinancePeriod(invoices, expenses, period),
        [expenses, invoices, period],
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
                <header className="px-1 py-1">
                    <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                        <div>
                            <p className="text-[11px] font-black uppercase tracking-wide text-accent">{text.eyebrow}</p>
                            <h1 className="mt-1 text-xl font-black text-[var(--text-main)] sm:text-2xl">{text.title}</h1>
                        </div>
                        <PremiumTabs<AnalyticsTab>
                            tabs={[
                                { id: "finance", label: text.tab_finance },
                                { id: "operations", label: text.tab_operations },
                            ]}
                            activeTab={activeTab}
                            onChange={setActiveTab}
                            className="w-full sm:w-auto sm:min-w-72"
                        />
                    </div>
                </header>

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
            icon: <CheckCircle2 className="h-4 w-4" />,
            tone: "positive" as const,
        },
        {
            label: text.pending,
            value: current.pending,
            previous: previous.pending,
            icon: <Clock3 className="h-4 w-4" />,
            tone: "warning" as const,
        },
        {
            label: text.expenses,
            value: current.expenses,
            previous: previous.expenses,
            icon: <ReceiptText className="h-4 w-4" />,
            tone: "danger" as const,
        },
        {
            label: text.overdue,
            value: current.overdue,
            previous: previous.overdue,
            icon: <TriangleAlert className="h-4 w-4" />,
            tone: "danger" as const,
        },
    ];

    return (
        <>
            <section className="grid grid-cols-2 gap-2.5 xl:grid-cols-4">
                {metricCards.map(({ label, value, previous, icon, tone }) => (
                    <MetricCard
                        key={label}
                        label={label}
                        value={value}
                        previous={previous}
                        icon={icon}
                        tone={tone}
                    />
                ))}
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
        { label: text.profit, value: current.profit, color: FINANCE_LINES[2].color },
    ];

    return (
        <article className="relative overflow-hidden rounded-[22px] border border-[var(--border-soft)] bg-[var(--bg-card-solid)] p-4">
            <div className="relative z-10 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div>
                    <div className="flex items-center gap-3">
                        <span className="flex h-8 w-8 items-center justify-center rounded-xl border border-[var(--border-soft)] bg-[var(--bg-secondary)] text-accent">
                            <Activity className="h-3.5 w-3.5" />
                        </span>
                        <div>
                            <h2 className="text-base font-black text-[var(--text-main)]">{text.trend_title}</h2>
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
                <div className="flex rounded-full border border-[var(--border-soft)] bg-[var(--bg-secondary)]/75 p-1">
                    {PERIODS.map((item) => (
                        <button
                            key={item}
                            type="button"
                            onClick={() => setPeriod(item)}
                            className={`h-7 rounded-full px-3 text-xs font-black transition ${
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
    return (
        <InteractiveLineChart
            labels={series.map((point) => point.label)}
            emptyLabel={text.empty_monthly}
            yFormatter={formatCompactCurrency}
            series={FINANCE_LINES.map((line) => ({
                id: line.key,
                label: text[line.labelKey],
                color: line.color,
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
        <article className="rounded-[22px] border border-[var(--border-soft)] bg-[var(--bg-card-solid)]/82 p-4 backdrop-blur-xl">
            <div className="mb-4 flex items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-[var(--border-soft)] bg-[var(--bg-secondary)] text-accent">
                    <PieChart className="h-4 w-4" />
                </span>
                <div>
                    <h2 className="text-base font-black text-[var(--text-main)]">{text.categories_title}</h2>
                    <p className="text-xs text-[var(--text-muted)]">{text.categories_subtitle}</p>
                </div>
            </div>

            <div className="space-y-2">
                {categoryTotals.map((item) => {
                    const percent = totalExpenses > 0 ? Math.round((item.total / totalExpenses) * 100) : 0;
                    return (
                        <div key={item.category} className="rounded-2xl border border-[var(--border-soft)] bg-[var(--bg-secondary)]/55 p-3">
                            <div className="mb-2 flex items-center justify-between gap-3 text-sm">
                                <span className="font-black text-[var(--text-main)]">
                                    {categoryLabels[item.category] || item.category}
                                </span>
                                <span className="font-black text-[var(--text-main)]">{formatCurrency(item.total)}</span>
                            </div>
                            <div className="flex items-center gap-3">
                                <div className="h-2 flex-1 overflow-hidden rounded-full bg-[var(--bg-card-solid)]/80">
                                    <div className="h-full rounded-full bg-accent/55" style={{ width: `${percent}%` }} />
                                </div>
                                <span className="w-10 text-right text-xs font-black text-[var(--text-muted)]">{percent}%</span>
                            </div>
                        </div>
                    );
                })}
                {categoryTotals.length === 0 && (
                    <div className="rounded-2xl border border-dashed border-[var(--border-soft)] bg-[var(--bg-secondary)] p-6 text-center text-sm text-[var(--text-muted)]">
                        {text.empty_categories}
                    </div>
                )}
            </div>
        </article>
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
            <div className="rounded-[28px] border border-[var(--border-soft)] bg-[var(--bg-card-solid)]/88 p-8 text-sm font-bold text-[var(--text-muted)]">
                {text.loading}
            </div>
        );
    }

    const summary = [
        {
            label: dict.analytics.completed,
            value: stats.completed.reduce((sum, value) => sum + value, 0),
            icon: <CheckCircle2 className="h-4 w-4" />,
            color: "var(--color-green-400)",
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
            <article className="rounded-[22px] border border-[var(--border-soft)] bg-[var(--bg-card-solid)] p-4">
                <div className="mb-4 flex items-center gap-3">
                    <span className="flex h-8 w-8 items-center justify-center rounded-xl border border-[var(--border-soft)] bg-[var(--bg-secondary)] text-accent">
                        <BarChart3 className="h-3.5 w-3.5" />
                    </span>
                    <div>
                        <h2 className="text-base font-black text-[var(--text-main)]">{dict.analytics.services_flow_title}</h2>
                        <p className="text-xs text-[var(--text-muted)]">{dict.analytics.services_flow_subtitle}</p>
                    </div>
                </div>
                <OperationsLineChart stats={stats} dict={dict} />
            </article>

            <article className="rounded-[22px] border border-[var(--border-soft)] bg-[var(--bg-card-solid)]/82 p-4 backdrop-blur-xl">
                <p className="text-[11px] font-black uppercase tracking-wide text-accent">{dict.analytics.services_flow_badge}</p>
                <h2 className="mt-1 text-base font-black text-[var(--text-main)]">{dict.analytics.ops_inspection}</h2>
                <div className="mt-4 grid grid-cols-2 gap-3">
                    {summary.map((item) => (
                        <div key={item.label} className="rounded-2xl border border-[var(--border-soft)] bg-[var(--bg-secondary)]/55 p-3">
                            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-[var(--bg-card-solid)]/70" style={{ color: item.color }}>
                                {item.icon}
                            </span>
                            <p className="mt-3 text-xl font-black text-[var(--text-main)]">{item.value}</p>
                            <p className="mt-1 text-[10px] font-black uppercase tracking-wide text-[var(--text-muted)]">{item.label}</p>
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
        { label: dict.analytics.completed, data: stats.completed, color: "var(--color-green-400)" },
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
        <span className="inline-flex items-center gap-2 rounded-full border border-[var(--border-soft)] bg-[var(--bg-secondary)]/70 px-3 py-1.5 text-xs font-black text-[var(--text-muted)]">
            <span className="h-2 w-2 rounded-full" style={{ background: color }} />
            <span>{label}</span>
            <span className="text-[var(--text-main)]">{formatCurrency(value)}</span>
        </span>
    );
}

function MetricCard({
    icon,
    label,
    value,
    previous,
}: {
    icon: ReactNode;
    label: string;
    value: number;
    previous: number;
    tone: "positive" | "warning" | "danger";
}) {
    const toneColor = "var(--accent-color)";

    return (
        <article className="rounded-[18px] border border-[var(--border-soft)] bg-[var(--bg-card-solid)]/74 p-3 backdrop-blur-xl">
            <div className="flex items-start justify-between gap-3">
                <span className="flex h-8 w-8 items-center justify-center rounded-xl border border-[var(--border-soft)] bg-[color-mix(in_srgb,var(--accent-color)_8%,var(--bg-secondary))]" style={{ color: toneColor }}>
                    {icon}
                </span>
                <DeltaBadge current={value} previous={previous} />
            </div>
            <p className="mt-3 text-[9px] font-black uppercase tracking-wide text-[var(--text-muted)] sm:text-[10px]">{label}</p>
            <p className="mt-1 text-xl font-black text-[var(--text-main)] sm:text-2xl">{formatCurrency(value)}</p>
        </article>
    );
}

function DeltaBadge({
    current,
    previous,
}: {
    current: number;
    previous: number;
}) {
    const delta = getDeltaPercent(current, previous);
    const positive = delta >= 0;
    return (
        <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-black ${
            positive
                ? "bg-[color-mix(in_srgb,var(--color-green-500)_10%,transparent)] text-[color-mix(in_srgb,var(--color-green-700)_78%,var(--text-muted))]"
                : "bg-[color-mix(in_srgb,var(--btn-cancel-bg)_80%,transparent)] text-[color-mix(in_srgb,var(--btn-cancel-text)_78%,var(--text-muted))]"
        }`}>
            {delta > 0 ? <ArrowUpRight className="h-3 w-3" /> : delta < 0 ? <ArrowDownRight className="h-3 w-3" /> : <Minus className="h-3 w-3" />}
            {formatDelta(delta)}
        </span>
    );
}

function getPointValue(point: FinanceSeriesPoint, key: (typeof FINANCE_LINES)[number]["key"]) {
    return point[key];
}

function getDeltaPercent(current: number, previous: number) {
    if (previous === 0) return current === 0 ? 0 : 100;
    return ((current - previous) / Math.abs(previous)) * 100;
}

function formatDelta(value: number) {
    const sign = value > 0 ? "+" : "";
    return `${sign}${value.toFixed(1)}%`;
}

function formatCompactCurrency(value: number) {
    const abs = Math.abs(value);
    const sign = value < 0 ? "-" : "";
    if (abs >= 1000000) return `${sign}${(abs / 1000000).toFixed(1)}M`;
    if (abs >= 1000) return `${sign}${(abs / 1000).toFixed(0)}k`;
    return `${sign}${Math.round(abs)}`;
}
