"use client";

import { useCallback, useEffect, useEffectEvent, useMemo, useRef, useState } from "react";
import { Calculator, FileText, Landmark, Loader2, ReceiptText } from "lucide-react";
import { redirect } from "next/navigation";

import { DataListTable, type DataListColumn } from "@/components/ui/data-list-table";
import { PageHeader } from "@/components/ui/page-header";
import { ReadRecoveryBanner } from "@/components/ui/read-recovery-banner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SummaryMetricCard, SummaryMetricGrid } from "@/components/ui/summary-metric-card";
import { canViewFinance, isPlatformSuperadmin } from "@/domain/access/roles";
import { useDictionary } from "@/lib/dictionary-context";
import { formatCurrency } from "@/lib/format";
import { getMetricTrend } from "@/lib/metric-trend";
import {
    classifyReadError,
    getReadRecoveryMessage,
    getReadWorkspaceKey,
    type ReadErrorKind,
} from "@/lib/read-recovery";
import {
    getFiscalPeriodActivityLabel,
    getFiscalSummaryYearOptions,
    getFiscalVatBalanceState,
} from "@/lib/fiscal-summary";
import { toast } from "@/lib/toast";
import { useUser } from "@/lib/user-context";
import {
    FiscalSummaryService,
    type FiscalPeriodSummary,
    type FiscalSummary,
} from "@/services/fiscal-summary.service";

const COLUMNS: DataListColumn[] = [
    { key: "period", label: "" },
    { key: "activity", label: "", className: "text-right" },
    { key: "output", label: "", className: "text-right" },
    { key: "input", label: "", className: "text-right" },
    { key: "balance", label: "", className: "text-right" },
    { key: "irpf", label: "", className: "text-right" },
];

function getFiscalActivityLabel(template: string, period: FiscalPeriodSummary) {
    return template.replace("{invoices}", period.issued_invoice_count.toString())
        .replace("{expenses}", period.registered_expense_count.toString());
}

export default function FiscalSummaryPage() {
    const { dict } = useDictionary();
    const { user, loading: userLoading } = useUser();
    const canViewSummary = canViewFinance(user) && !isPlatformSuperadmin(user);
    const workspaceKey = getReadWorkspaceKey(user);
    const currentYear = new Date().getFullYear();
    const [year, setYear] = useState(currentYear);
    const [summary, setSummary] = useState<FiscalSummary | null>(null);
    const [previousSummary, setPreviousSummary] = useState<FiscalSummary | null>(null);
    const [loading, setLoading] = useState(true);
    const [errorKind, setErrorKind] = useState<ReadErrorKind | null>(null);
    const [loadedContext, setLoadedContext] = useState<string | null>(null);
    const requestIdRef = useRef(0);
    const loadedContextRef = useRef<string | null>(null);
    const text = dict.fiscal_summary;
    const contextKey = `${workspaceKey}|${year}`;

    const loadSummary = useCallback(async () => {
        if (!canViewSummary) return;
        const requestId = ++requestIdRef.current;
        const targetContext = `${workspaceKey}|${year}`;
        if (loadedContextRef.current !== targetContext) {
            setSummary(null);
            setPreviousSummary(null);
            loadedContextRef.current = null;
            setLoadedContext(null);
        }
        try {
            setLoading(true);
            const [current, previous] = await Promise.all([
                FiscalSummaryService.getSummary(year),
                FiscalSummaryService.getSummary(year - 1).catch(() => null),
            ]);
            if (requestId !== requestIdRef.current) return;
            setSummary(current);
            setPreviousSummary(previous);
            loadedContextRef.current = targetContext;
            setLoadedContext(targetContext);
            setErrorKind(null);
        } catch (error) {
            if (requestId !== requestIdRef.current) return;
            const kind = classifyReadError(error);
            setErrorKind(kind);
            if (kind === "denied" || loadedContextRef.current !== targetContext) {
                setSummary(null);
                setPreviousSummary(null);
                loadedContextRef.current = null;
                setLoadedContext(null);
            }
            toast.error(kind === "denied" ? text.error_denied : text.error_load);
        } finally {
            setLoading((current) => requestId === requestIdRef.current ? false : current);
        }
    }, [canViewSummary, text.error_denied, text.error_load, workspaceKey, year]);

    const loadSummaryEvent = useEffectEvent(loadSummary);

    useEffect(() => {
        if (userLoading || !canViewSummary) return;
        const timer = window.setTimeout(() => void loadSummaryEvent(), 0);
        return () => window.clearTimeout(timer);
    }, [canViewSummary, userLoading, workspaceKey, year]);

    const yearOptions = useMemo(
        () => getFiscalSummaryYearOptions(year, currentYear),
        [currentYear, year],
    );

    if (!userLoading && !canViewSummary) redirect("/dashboard");

    if (userLoading || (loading && !summary && !errorKind)) {
        return <FiscalSummaryLoading label={text.loading} />;
    }

    if (!canViewSummary) return null;

    const hasValidSnapshot = Boolean(summary && loadedContext === contextKey && errorKind !== "denied");
    const errorMessage = getReadRecoveryMessage(errorKind, {
        unavailable: text.error_load,
        denied: text.error_denied,
    });
    const vatBalanceState = summary ? getFiscalVatBalanceState(summary.annual.estimated_vat_balance) : "balanced";
    const vatBalanceLabel = vatBalanceState === "payable"
        ? text.vat_payable
        : vatBalanceState === "credit"
            ? text.vat_credit
            : text.vat_balanced;

    return (
        <div className="min-h-full px-3 py-3 sm:px-5 lg:px-6">
            <div className="mx-auto flex w-full max-w-[112rem] flex-col gap-4">
                <PageHeader
                    icon={Calculator}
                    title={text.title}
                    subtitle={text.subtitle}
                    actions={errorKind !== "denied" ? (
                        <Select value={String(year)} onValueChange={(value) => setYear(Number(value))}>
                            <SelectTrigger aria-label={text.year} className="h-10 min-w-20 text-sm font-semibold"><SelectValue /></SelectTrigger>
                            <SelectContent>{yearOptions.map((option) => <SelectItem key={option} value={String(option)}>{option}</SelectItem>)}</SelectContent>
                        </Select>
                    ) : undefined}
                />

                {errorKind && errorMessage && (
                    <ReadRecoveryBanner
                        kind={errorKind}
                        message={errorMessage}
                        retryLabel={text.retry}
                        onRetry={errorKind === "unavailable" ? () => void loadSummary() : undefined}
                        retrying={loading}
                    />
                )}

                {!hasValidSnapshot && loading && <FiscalSummaryLoading label={text.loading} />}

                {hasValidSnapshot && summary && (
                <>
                <SummaryMetricGrid desktopColumns={4} aria-label={text.annual_totals}>
                    <SummaryMetricCard label={text.output_vat} value={formatCurrency(summary.annual.output_vat_amount)} description={text.output_vat_desc} icon={ReceiptText} trend={previousSummary ? getMetricTrend(summary.annual.output_vat_amount, previousSummary.annual.output_vat_amount) : undefined} />
                    <SummaryMetricCard label={text.input_vat} value={formatCurrency(summary.annual.registered_input_vat_amount)} description={text.input_vat_desc} icon={FileText} trend={previousSummary ? getMetricTrend(summary.annual.registered_input_vat_amount, previousSummary.annual.registered_input_vat_amount) : undefined} />
                    <SummaryMetricCard label={vatBalanceLabel} value={formatCurrency(Math.abs(summary.annual.estimated_vat_balance))} description={text.vat_balance_desc} icon={Landmark} trend={previousSummary ? getMetricTrend(Math.abs(summary.annual.estimated_vat_balance), Math.abs(previousSummary.annual.estimated_vat_balance)) : undefined} />
                    <SummaryMetricCard label={text.irpf_withheld} value={formatCurrency(summary.annual.withheld_irpf_amount)} description={text.irpf_withheld_desc} icon={Calculator} trend={previousSummary ? getMetricTrend(summary.annual.withheld_irpf_amount, previousSummary.annual.withheld_irpf_amount) : undefined} />
                </SummaryMetricGrid>

                <p className="rounded-xl border border-[var(--border-soft)] bg-[var(--bg-tertiary)] px-3 py-2 text-xs text-[var(--text-muted)]">
                    {text.disclaimer}
                </p>

                <DataListTable
                    items={summary.periods}
                    getRowKey={(period) => period.key}
                    columns={COLUMNS.map((column) => ({
                        ...column,
                        label: <span className="block whitespace-normal break-words">{column.key === "period" ? text.period
                            : column.key === "activity" ? text.activity_header
                                : column.key === "output" ? text.output_vat
                                    : column.key === "input" ? text.input_vat
                                        : column.key === "balance" ? text.vat_balance
                                            : text.irpf_withheld}</span>,
                    }))}
                    header={{ title: text.periods_title, subtitle: text.periods_subtitle }}
                    desktopFrom="lg"
                    rowAriaLabel={(period) => `${period.label}: ${getFiscalActivityLabel(text.activity, period)}`}
                    renderDesktopRow={(period) => (
                        <>
                            <span className="font-mono text-xs font-semibold text-[var(--text-main)]">{period.label}</span>
                            <span className="text-right text-xs text-[var(--text-muted)]">{getFiscalPeriodActivityLabel(period)}</span>
                            <span className="text-right font-mono text-xs text-[var(--text-main)]">{formatCurrency(period.output_vat_amount)}</span>
                            <span className="text-right font-mono text-xs text-[var(--text-main)]">{formatCurrency(period.registered_input_vat_amount)}</span>
                            <span className="text-right font-mono text-xs font-semibold text-[var(--text-main)]">{formatCurrency(period.estimated_vat_balance)}</span>
                            <span className="text-right font-mono text-xs text-[var(--text-main)]">{formatCurrency(period.withheld_irpf_amount)}</span>
                        </>
                    )}
                    renderCompactRow={(period) => (
                        <div className="space-y-3">
                            <div className="flex items-start justify-between gap-3">
                                <div>
                                    <p className="font-mono text-xs font-semibold text-[var(--text-main)]">{period.label}</p>
                                    <p className="mt-1 text-[11px] text-[var(--text-muted)]">{getFiscalActivityLabel(text.activity, period)}</p>
                                </div>
                                <strong className="font-mono text-sm text-[var(--text-main)]">{formatCurrency(period.estimated_vat_balance)}</strong>
                            </div>
                            <div className="grid grid-cols-3 gap-2 text-xs">
                                <span><span className="block text-[10px] text-[var(--text-muted)]">{text.output_vat}</span><strong className="font-mono text-[var(--text-main)]">{formatCurrency(period.output_vat_amount)}</strong></span>
                                <span><span className="block text-[10px] text-[var(--text-muted)]">{text.input_vat}</span><strong className="font-mono text-[var(--text-main)]">{formatCurrency(period.registered_input_vat_amount)}</strong></span>
                                <span><span className="block text-[10px] text-[var(--text-muted)]">{text.irpf_withheld}</span><strong className="font-mono text-[var(--text-main)]">{formatCurrency(period.withheld_irpf_amount)}</strong></span>
                            </div>
                        </div>
                    )}
                />
                </>
                )}
            </div>
        </div>
    );
}

function FiscalSummaryLoading({ label }: { label: string }) {
    return (
        <div className="flex h-full items-center justify-center gap-2 text-sm font-semibold text-[var(--text-muted)]">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            {label}
        </div>
    );
}
