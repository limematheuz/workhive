"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Calculator, FileText, Landmark, Loader2, ReceiptText } from "lucide-react";
import { redirect } from "next/navigation";

import { DataListTable, type DataListColumn } from "@/components/ui/data-list-table";
import { PageHeader } from "@/components/ui/page-header";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SummaryMetricGrid } from "@/components/ui/summary-metric-card";
import { canViewFinance, isPlatformSuperadmin } from "@/domain/access/roles";
import { useDictionary } from "@/lib/dictionary-context";
import { formatCurrency } from "@/lib/format";
import { FinanceMetricButton } from "@/components/finance/FinanceMetricButton";
import { FinanceLoadError } from "@/components/finance/FinanceLoadError";
import { FiscalSourceDialog } from "@/components/finance/FiscalSourceDialog";
import { Button } from "@/components/ui/button";
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
    const currentYear = new Date().getFullYear();
    const [year, setYear] = useState(currentYear);
    const [summary, setSummary] = useState<FiscalSummary | null>(null);
    const [selectedPeriod, setSelectedPeriod] = useState("annual");
    const [sourceScope, setSourceScope] = useState<"sales" | "expenses" | "all" | "withholding" | null>(null);
    const [loadError, setLoadError] = useState(false);
    const [loading, setLoading] = useState(true);
    const text = dict.fiscal_summary;

    const loadSummary = useCallback(async () => {
        if (!canViewSummary) return;
        try {
            setLoading(true);
            setLoadError(false);
            setSummary(await FiscalSummaryService.getSummary(year));
        } catch {
            setSummary(null);
            setLoadError(true);
            toast.error(text.error_load);
        } finally {
            setLoading(false);
        }
    }, [canViewSummary, text.error_load, year]);

    useEffect(() => {
        if (userLoading || !canViewSummary) return;
        const timer = window.setTimeout(() => void loadSummary(), 0);
        return () => window.clearTimeout(timer);
    }, [canViewSummary, loadSummary, userLoading]);

    const yearOptions = useMemo(
        () => getFiscalSummaryYearOptions(year, currentYear),
        [currentYear, year],
    );

    if (!userLoading && !canViewSummary) redirect("/dashboard");

    if (userLoading || loading) {
        return <FiscalSummaryLoading label={text.loading} />;
    }

    if (!canViewSummary) return null;

    if (loadError || !summary) return <div className="p-5"><FinanceLoadError message="No se ha podido consultar un resumen fiscal válido. Revisa el origen o vuelve a intentarlo." onRetry={() => void loadSummary()} /></div>;
    const selected = selectedPeriod === "annual" ? summary.annual : summary.periods.find((item) => item.key === selectedPeriod) ?? summary.annual;

    const vatBalanceState = getFiscalVatBalanceState(selected.estimated_vat_balance);
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
                    actions={(
                        <Select value={String(year)} onValueChange={(value) => { setYear(Number(value)); setSelectedPeriod("annual"); }}>
                            <SelectTrigger aria-label={text.year} className="h-10 min-w-20 text-sm font-semibold"><SelectValue /></SelectTrigger>
                            <SelectContent>{yearOptions.map((option) => <SelectItem key={option} value={String(option)}>{option}</SelectItem>)}</SelectContent>
                        </Select>
                    )}
                />

                <section className="billing-surface flex flex-wrap items-center justify-between gap-3 rounded-xl p-3"><label className="flex items-center gap-3 text-sm font-medium">Periodo fiscal<Select value={selectedPeriod} onValueChange={setSelectedPeriod}><SelectTrigger aria-label="Periodo fiscal" className="min-w-36"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="annual">Año completo</SelectItem>{summary.periods.map((item) => <SelectItem key={item.key} value={item.key}>{item.label}</SelectItem>)}</SelectContent></Select></label><span className="text-xs text-muted-foreground">EUR · Ejercicio {year} · Actualizado al consultar</span><Button variant="outline" size="sm" onClick={() => setSourceScope("all")}>Ver y exportar origen</Button></section>
                <SummaryMetricGrid desktopColumns={4} aria-label={text.annual_totals}>
                    <FinanceMetricButton label={text.output_vat} value={formatCurrency(selected.output_vat_amount)} description={`Base de ventas: ${formatCurrency(selected.output_base_amount)} · ver documentos`} icon={ReceiptText} onClick={() => setSourceScope("sales")} />
                    <FinanceMetricButton label={text.input_vat} value={formatCurrency(selected.registered_input_vat_amount)} description={`Base de gastos: ${formatCurrency(selected.registered_expense_base_amount)} · ver registros`} icon={FileText} onClick={() => setSourceScope("expenses")} />
                    <FinanceMetricButton label={vatBalanceLabel} value={formatCurrency(Math.abs(selected.estimated_vat_balance))} description="Orientativo · repercutido menos soportado registrado" icon={Landmark} onClick={() => setSourceScope("all")} />
                    <FinanceMetricButton label={text.irpf_withheld} value={formatCurrency(selected.withheld_irpf_amount)} description="Retenciones en las facturas del periodo" icon={Calculator} onClick={() => setSourceScope("withholding")} />
                </SummaryMetricGrid>
                {sourceScope && <FiscalSourceDialog year={year} period={selectedPeriod} scope={sourceScope} onClose={() => setSourceScope(null)} />}

                <p className="rounded-xl border border-[var(--border-soft)] bg-[var(--bg-tertiary)] px-3 py-2 text-xs text-[var(--text-muted)]">
                    {text.disclaimer}
                </p>

                <DataListTable
                    items={selectedPeriod === "annual" ? summary.periods : summary.periods.filter((item) => item.key === selectedPeriod)}
                    onRowClick={(item) => setSelectedPeriod(item.key)}
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
