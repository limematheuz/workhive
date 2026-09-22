"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CheckCircle2, Clock3, Download, FileSpreadsheet, FileText, Loader2, Pencil, Plus, ReceiptText, Search, Upload } from "lucide-react";
import { redirect } from "next/navigation";

import { SalesLedgerImportDialog } from "@/components/invoices/SalesLedgerImportDialog";
import { SalesLedgerRecordDialog } from "@/components/invoices/SalesLedgerRecordDialog";
import { DataListTable, type DataListColumn } from "@/components/ui/data-list-table";
import { SummaryMetricCard, SummaryMetricGrid } from "@/components/ui/summary-metric-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { canManageFinance, canViewFinance, isPlatformSuperadmin } from "@/domain/access/roles";
import { useDictionary, type Dictionary } from "@/lib/dictionary-context";
import { formatCurrency, formatDate } from "@/lib/format";
import { getPercentageChange } from "@/lib/metric-trend";
import {
    buildSalesLedgerCsv,
    filterSalesLedgerEntries,
    getSalesLedgerYears,
    SALES_LEDGER_CSV_TEMPLATE,
    summarizeSalesLedger,
} from "@/lib/sales-ledger";
import { toast } from "@/lib/toast";
import { useUser } from "@/lib/user-context";
import {
    SalesLedgerService,
    type SalesLedgerEntry,
    type SalesLedgerManualRecordInput,
} from "@/services/sales-ledger.service";

const LEDGER_COLUMNS: DataListColumn[] = [
    { key: "number", label: "N Factura" },
    { key: "date", label: "Fecha" },
    { key: "client", label: "Cliente" },
    { key: "total", label: "Importe total", className: "text-right" },
    { key: "base", label: "Base", className: "text-right" },
    { key: "tax", label: "IVA", className: "text-right" },
    { key: "status", label: "Cobrada" },
    { key: "actions", label: "", className: "text-right" },
];

type InvoiceCopy = Dictionary["invoices"];

function downloadCsv(content: string, name: string) {
    const url = URL.createObjectURL(new Blob([content], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = name;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
}

function errorMessage(error: unknown, fallback: string): string {
    return error instanceof Error && error.message ? error.message : fallback;
}

export default function InvoiceSummaryPage() {
    const { dict } = useDictionary();
    const { user, loading: userLoading } = useUser();
    const copy = dict.invoices;
    const canViewSummary = canViewFinance(user) && !isPlatformSuperadmin(user);
    const canManageSummary = canManageFinance(user) && !isPlatformSuperadmin(user);
    const [entries, setEntries] = useState<SalesLedgerEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [year, setYear] = useState("");
    const [search, setSearch] = useState("");
    const [recordDialogOpen, setRecordDialogOpen] = useState(false);
    const [importDialogOpen, setImportDialogOpen] = useState(false);
    const [selectedEntry, setSelectedEntry] = useState<SalesLedgerEntry | null>(null);

    const loadLedger = useCallback(async () => {
        if (!canViewSummary) return;
        try {
            setLoading(true);
            setEntries(await SalesLedgerService.getEntries({ limit: 500 }));
        } catch (error) {
            toast.error(errorMessage(error, copy.error_load));
        } finally {
            setLoading(false);
        }
    }, [canViewSummary, copy.error_load]);

    useEffect(() => {
        if (userLoading || !canViewSummary) return;
        const timer = window.setTimeout(() => void loadLedger(), 0);
        return () => window.clearTimeout(timer);
    }, [canViewSummary, loadLedger, userLoading]);

    const rows = useMemo(() => filterSalesLedgerEntries(entries, { year, search }), [entries, search, year]);
    const totals = useMemo(() => summarizeSalesLedger(rows), [rows]);
    const previousTotals = useMemo(() => {
        if (!/^\d{4}$/.test(year)) return null;
        return summarizeSalesLedger(filterSalesLedgerEntries(entries, {
            year: String(Number(year) - 1),
            search,
        }));
    }, [entries, search, year]);
    const years = useMemo(() => getSalesLedgerYears(entries), [entries]);

    const openNewRecord = () => {
        setSelectedEntry(null);
        setRecordDialogOpen(true);
    };

    const openEditRecord = (entry: SalesLedgerEntry) => {
        if (!entry.is_editable) return;
        setSelectedEntry(entry);
        setRecordDialogOpen(true);
    };

    const saveRecord = async (payload: SalesLedgerManualRecordInput) => {
        setSaving(true);
        try {
            if (selectedEntry) await SalesLedgerService.updateManualRecord(selectedEntry.source_id, payload);
            else await SalesLedgerService.createManualRecord(payload);
            toast.success(copy.ledger_save_success);
            setRecordDialogOpen(false);
            await loadLedger();
        } catch (error) {
            toast.error(errorMessage(error, copy.error_load));
        } finally {
            setSaving(false);
        }
    };

    const deleteRecord = async () => {
        if (!selectedEntry) return;
        setSaving(true);
        try {
            await SalesLedgerService.deleteManualRecord(selectedEntry.source_id);
            toast.success(copy.ledger_delete_success);
            setRecordDialogOpen(false);
            await loadLedger();
        } catch (error) {
            toast.error(errorMessage(error, copy.error_load));
        } finally {
            setSaving(false);
        }
    };

    const previewImport = async (file: File) => {
        try {
            return await SalesLedgerService.previewImport(file);
        } catch (error) {
            toast.error(errorMessage(error, copy.error_load));
            throw error;
        }
    };

    const importCsv = async (file: File) => {
        setSaving(true);
        try {
            const result = await SalesLedgerService.importCsv(file);
            toast.success(copy.ledger_import_success.replace("{count}", String(result.created_count)));
            setImportDialogOpen(false);
            await loadLedger();
        } catch (error) {
            toast.error(errorMessage(error, copy.error_load));
        } finally {
            setSaving(false);
        }
    };

    if (!userLoading && !canViewSummary) redirect("/dashboard");

    if (userLoading) return <SummaryLoading label={dict.dashboard.loading} />;

    if (!canViewSummary) return null;

    return (
        <div className="min-h-full px-3 py-3 sm:px-5 lg:px-6">
            <div className="mx-auto flex w-full max-w-[112rem] flex-col gap-4">
                <PageHeader icon={ReceiptText} title={copy.ledger_title} subtitle={copy.ledger_subtitle} />

                <SummaryMetricGrid desktopColumns={5} aria-label={copy.ledger_totals}>
                    <SummaryMetricCard label={copy.ledger_base} value={formatCurrency(totals.base)} icon={FileText} trend={previousTotals ? toTrend(totals.base, previousTotals.base) : undefined} />
                    <SummaryMetricCard label={copy.ledger_vat} value={formatCurrency(totals.tax)} icon={ReceiptText} trend={previousTotals ? toTrend(totals.tax, previousTotals.tax) : undefined} />
                    <SummaryMetricCard label={copy.ledger_total} value={formatCurrency(totals.total)} icon={FileText} trend={previousTotals ? toTrend(totals.total, previousTotals.total) : undefined} />
                    <SummaryMetricCard label={copy.ledger_paid} value={formatCurrency(totals.paid)} icon={CheckCircle2} trend={previousTotals ? toTrend(totals.paid, previousTotals.paid) : undefined} />
                    <SummaryMetricCard label={copy.ledger_pending} value={formatCurrency(totals.pending)} icon={Clock3} trend={previousTotals ? toTrend(totals.pending, previousTotals.pending, "lower") : undefined} />
                </SummaryMetricGrid>

                <DataListTable
                    items={rows}
                    getRowKey={(entry) => `${entry.source_type}-${entry.source_id}`}
                    columns={LEDGER_COLUMNS.map((column) => ({
                        ...column,
                        label: column.key === "number" ? copy.invoice_number
                            : column.key === "date" ? copy.ledger_date
                                : column.key === "client" ? copy.client
                                    : column.key === "total" ? copy.ledger_total
                                        : column.key === "base" ? copy.ledger_base
                                            : column.key === "tax" ? copy.ledger_vat
                                                : column.key === "status" ? copy.ledger_collected
                                                    : column.label,
                    }))}
                    header={{ title: copy.ledger_title, subtitle: copy.ledger_rectification_note, countLabel: copy.ledger_records.replace("{count}", String(rows.length)) }}
                    loading={loading}
                    loadingLabel={copy.ledger_loading}
                    desktopFrom="lg"
                    toolbar={(
                        <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
                            <label className="relative min-w-0 flex-1">
                                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]" aria-hidden="true" />
                                <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={copy.ledger_search_placeholder} className="h-10 w-full py-2 pl-9 pr-3 text-sm" />
                            </label>
                            <Select value={year || "all"} onValueChange={(value) => setYear(value === "all" ? "" : value)}>
                                <SelectTrigger aria-label={copy.ledger_all_years} className="h-10 text-sm"><SelectValue /></SelectTrigger>
                                <SelectContent><SelectItem value="all">{copy.ledger_all_years}</SelectItem>{years.map((availableYear) => <SelectItem key={availableYear} value={availableYear}>{availableYear}</SelectItem>)}</SelectContent>
                            </Select>
                            <div className="flex flex-wrap gap-2">
                                <Button type="button" variant="outline" size="sm" onClick={() => downloadCsv(SALES_LEDGER_CSV_TEMPLATE, "plantilla-libro-ventas.csv")}><FileSpreadsheet />{copy.ledger_csv_template}</Button>
                                {canManageSummary && <Button type="button" variant="outline" size="sm" onClick={() => setImportDialogOpen(true)}><Upload />{copy.ledger_import_csv}</Button>}
                                <Button type="button" variant="outline" size="sm" onClick={() => downloadCsv(buildSalesLedgerCsv(rows), `libro-ventas${year ? `-${year}` : ""}.csv`)} disabled={rows.length === 0}><Download />{copy.ledger_export_csv}</Button>
                                {canManageSummary && <Button type="button" size="sm" onClick={openNewRecord}><Plus />{copy.ledger_add_record}</Button>}
                            </div>
                        </div>
                    )}
                    empty={<p className="text-sm text-[var(--text-muted)]">{copy.ledger_empty}</p>}
                    rowAriaLabel={(entry) => `${entry.document_number}: ${entry.client_name}`}
                    renderDesktopRow={(entry) => renderLedgerDesktopCells(entry, copy, openEditRecord, canManageSummary)}
                    renderCompactRow={(entry) => <LedgerCompactRow entry={entry} copy={copy} onEdit={openEditRecord} canManage={canManageSummary} />}
                />
            </div>

            {canManageSummary && <SalesLedgerRecordDialog key={`${recordDialogOpen}-${selectedEntry?.source_id ?? "new"}`} entry={selectedEntry} open={recordDialogOpen} busy={saving} onOpenChange={setRecordDialogOpen} onSave={saveRecord} onDelete={deleteRecord} />}
            {canManageSummary && <SalesLedgerImportDialog open={importDialogOpen} busy={saving} onOpenChange={setImportDialogOpen} onPreview={previewImport} onImport={importCsv} />}
        </div>
    );
}

function toTrend(current: number, previous: number, comparisonDirection?: "higher" | "lower") {
    const value = getPercentageChange(current, previous);
    return value === null ? undefined : { value, comparisonDirection };
}

function renderLedgerDesktopCells(entry: SalesLedgerEntry, copy: InvoiceCopy, onEdit: (entry: SalesLedgerEntry) => void, canManage: boolean) {
    return [
        <span key="number" className="flex min-w-0 items-center gap-2"><span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-accent/10 text-accent"><ReceiptText className="size-4" /></span><span className="truncate font-mono text-xs font-semibold text-[var(--text-main)]">{entry.document_number}</span></span>,
        <span key="date" className="text-xs text-[var(--text-muted)]">{formatDate(entry.entry_date)}</span>,
        <span key="client" className="min-w-0"><span className="block truncate text-xs font-semibold text-[var(--text-main)]">{entry.client_name}</span><span className="mt-0.5 block text-[10px] text-[var(--text-muted)]">{entry.is_editable ? copy.ledger_manual_record : copy.ledger_invoice_read_only}</span></span>,
        <span key="total" className="text-right font-mono text-xs font-semibold text-[var(--text-main)]">{formatCurrency(entry.total_amount)}</span>,
        <span key="base" className="text-right font-mono text-xs text-[var(--text-main)]">{formatCurrency(entry.base_amount)}</span>,
        <span key="tax" className="text-right font-mono text-xs text-[var(--text-main)]">{formatCurrency(entry.tax_amount)}</span>,
        <PaymentBadge key="status" entry={entry} copy={copy} />,
        <span key="actions" className="flex justify-end">{canManage && entry.is_editable && <Button type="button" size="icon-xs" variant="outline" onClick={() => onEdit(entry)} aria-label={copy.ledger_action_edit}><Pencil /></Button>}</span>,
    ];
}

function LedgerCompactRow({ entry, copy, onEdit, canManage }: { entry: SalesLedgerEntry; copy: InvoiceCopy; onEdit: (entry: SalesLedgerEntry) => void; canManage: boolean }) {
    return (
        <div className="space-y-3">
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0"><p className="truncate font-mono text-xs font-semibold text-[var(--text-main)]">{entry.document_number}</p><p className="mt-1 truncate text-sm font-semibold text-[var(--text-main)]">{entry.client_name}</p></div>
                <PaymentBadge entry={entry} copy={copy} />
            </div>
            <div className="grid grid-cols-3 gap-2 text-xs">
                <span><span className="block text-[10px] text-[var(--text-muted)]">{copy.ledger_base}</span><strong className="font-mono text-[var(--text-main)]">{formatCurrency(entry.base_amount)}</strong></span>
                <span><span className="block text-[10px] text-[var(--text-muted)]">{copy.ledger_vat}</span><strong className="font-mono text-[var(--text-main)]">{formatCurrency(entry.tax_amount)}</strong></span>
                <span><span className="block text-[10px] text-[var(--text-muted)]">{copy.ledger_total}</span><strong className="font-mono text-[var(--text-main)]">{formatCurrency(entry.total_amount)}</strong></span>
            </div>
            <div className="flex items-center justify-between gap-3 text-[11px] text-[var(--text-muted)]"><span>{formatDate(entry.entry_date)}</span>{canManage && entry.is_editable ? <Button type="button" size="xs" variant="outline" onClick={() => onEdit(entry)}><Pencil />{copy.ledger_action_edit}</Button> : <span>{copy.ledger_invoice_read_only}</span>}</div>
        </div>
    );
}

function PaymentBadge({ entry, copy }: { entry: SalesLedgerEntry; copy: InvoiceCopy }) {
    const paid = entry.payment_status === "paid";
    return <span className={`w-fit rounded-full border px-2 py-0.5 text-[9px] font-semibold uppercase ${paid ? "border-[var(--btn-secondary-border)] bg-[var(--btn-secondary-bg)] text-[var(--btn-secondary-text)]" : "border-[var(--border-color)] bg-[var(--bg-tertiary)] text-[var(--text-muted)]"}`}>{paid ? copy.ledger_status_paid : copy.ledger_status_pending}</span>;
}

function SummaryLoading({ label }: { label: string }) {
    return <div className="flex h-full items-center justify-center gap-2 text-sm font-semibold text-[var(--text-muted)]"><Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />{label}</div>;
}
