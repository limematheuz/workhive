"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CheckCircle2, Clock3, Download, FileSpreadsheet, FileText, Loader2, ReceiptText, Search } from "lucide-react";

import { DataListTable, type DataListColumn } from "@/components/ui/data-list-table";
import { PageHeader } from "@/components/ui/page-header";
import { canAdministerCompany, isPlatformSuperadmin } from "@/domain/access/roles";
import { getInvoiceStatusText, getStatusBadgeClass } from "@/components/invoices/invoice-status-utils";
import { useDictionary } from "@/lib/dictionary-context";
import { formatCurrency, formatDate } from "@/lib/format";
import { useUser } from "@/lib/user-context";
import {
    buildInvoiceSummaryRows,
    filterInvoiceSummaryRows,
    getInvoiceIssueYear,
    summarizeInvoiceSummaryRows,
} from "@/lib/invoice-summary";
import { buildInvoiceSummaryCsv, INVOICE_SUMMARY_CSV_TEMPLATE } from "@/lib/invoice-summary-csv";
import { toast } from "@/lib/toast";
import { ClientService, type Client } from "@/services/client.service";
import { InvoiceService } from "@/services/invoice.service";
import type { Invoice } from "@/types/invoice";

const LEDGER_COLUMNS: DataListColumn[] = [
    { key: "number", label: "N Factura" },
    { key: "date", label: "Fecha" },
    { key: "client", label: "Cliente" },
    { key: "total", label: "Importe total", className: "text-right" },
    { key: "base", label: "Base", className: "text-right" },
    { key: "tax", label: "IVA", className: "text-right" },
    { key: "status", label: "Cobrada" },
];

function SummaryMetric({ label, value, icon: Icon }: { label: string; value: string; icon: typeof FileText }) {
    return (
        <article className="billing-block rounded-[22px] p-4">
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--text-muted)] sm:text-[11px]">
                        {label}
                    </p>
                    <p className="mt-2 font-mono text-xl font-semibold leading-tight text-[var(--text-main)] sm:text-2xl">
                        {value}
                    </p>
                </div>
                <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-[var(--brand-blue-soft)] text-accent" aria-hidden="true">
                    <Icon className="h-4 w-4" />
                </span>
            </div>
        </article>
    );
}

function getAvailableYears(invoices: Invoice[]): string[] {
    return Array.from(new Set(invoices.flatMap((invoice) => {
        const year = getInvoiceIssueYear(invoice.issue_date);
        return year ? [year] : [];
    }))).sort((first, second) => Number(second) - Number(first));
}

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

export default function InvoiceSummaryPage() {
    const { dict } = useDictionary();
    const { user, loading: userLoading } = useUser();
    const canViewSummary = canAdministerCompany(user) && !isPlatformSuperadmin(user);
    const [invoices, setInvoices] = useState<Invoice[]>([]);
    const [clients, setClients] = useState<Client[]>([]);
    const [loading, setLoading] = useState(true);
    const [year, setYear] = useState("");
    const [search, setSearch] = useState("");

    const loadSummary = useCallback(async () => {
        if (!canViewSummary) return;
        try {
            setLoading(true);
            const [invoiceData, clientData] = await Promise.all([
                InvoiceService.getAllInvoices(),
                ClientService.getClients(null),
            ]);
            setInvoices(invoiceData);
            setClients(clientData);
        } catch {
            toast.error(dict.invoices.error_load);
        } finally {
            setLoading(false);
        }
    }, [canViewSummary, dict.invoices.error_load]);

    useEffect(() => {
        if (userLoading || !canViewSummary) return;
        const timer = window.setTimeout(() => void loadSummary(), 0);
        return () => window.clearTimeout(timer);
    }, [canViewSummary, loadSummary, userLoading]);

    const clientNames = useMemo(
        () => new Map(clients.map((client) => [client.id, client.name])),
        [clients],
    );
    const rows = useMemo(
        () => filterInvoiceSummaryRows(buildInvoiceSummaryRows(invoices, clientNames), { year, search }),
        [clientNames, invoices, search, year],
    );
    const totals = useMemo(() => summarizeInvoiceSummaryRows(rows), [rows]);
    const years = useMemo(() => getAvailableYears(invoices), [invoices]);
    const labels = dict.invoices;

    if (userLoading) {
        return <SummaryLoading label={dict.dashboard.loading} />;
    }

    if (!canViewSummary) {
        return (
            <div className="mx-auto max-w-3xl rounded-2xl border border-[var(--border-soft)] bg-[var(--bg-card-solid)] p-6">
                <p className="text-lg font-black text-[var(--text-main)]">{dict.finance_analytics.restricted_title}</p>
                <p className="mt-2 text-sm text-[var(--text-muted)]">{dict.finance_analytics.restricted_desc}</p>
            </div>
        );
    }

    if (loading) {
        return <SummaryLoading label={labels.ledger_loading} />;
    }

    const statusLabel = (invoice: Invoice) => getInvoiceStatusText(invoice.status, labels);

    const handleExportCsv = () => downloadCsv(
        buildInvoiceSummaryCsv(rows),
        `resumen-facturas${year ? `-${year}` : ""}.csv`,
    );

    return (
        <div className="min-h-full px-3 py-3 sm:px-5 lg:px-6">
            <div className="mx-auto flex w-full max-w-[112rem] flex-col gap-4">
                <PageHeader icon={ReceiptText} title={labels.ledger_title} subtitle={labels.ledger_subtitle} />

                <section className="grid grid-cols-2 gap-3 xl:grid-cols-5" aria-label={labels.ledger_totals}>
                    <SummaryMetric label={labels.ledger_base} value={formatCurrency(totals.base)} icon={FileText} />
                    <SummaryMetric label={labels.ledger_vat} value={formatCurrency(totals.tax)} icon={ReceiptText} />
                    <SummaryMetric label={labels.ledger_total} value={formatCurrency(totals.total)} icon={FileText} />
                    <SummaryMetric label={labels.ledger_paid} value={formatCurrency(totals.paid)} icon={CheckCircle2} />
                    <SummaryMetric label={labels.ledger_pending} value={formatCurrency(totals.pending)} icon={Clock3} />
                </section>

                <DataListTable
                    items={rows}
                    getRowKey={(row) => row.invoice.id}
                    columns={LEDGER_COLUMNS.map((column) => ({
                        ...column,
                        label: column.key === "number" ? labels.invoice_number
                            : column.key === "date" ? labels.ledger_date
                                : column.key === "client" ? labels.client
                                    : column.key === "total" ? labels.ledger_total
                                        : column.key === "base" ? labels.ledger_base
                                            : column.key === "tax" ? labels.ledger_vat
                                                : column.key === "status" ? labels.ledger_collected
                                                    : column.label,
                    }))}
                    gridClassName="grid-cols-[minmax(7.5rem,.9fr)_minmax(6.5rem,.75fr)_minmax(10rem,1.3fr)_minmax(7.5rem,.85fr)_minmax(6.5rem,.72fr)_minmax(6.5rem,.72fr)_minmax(6.5rem,.72fr)]"
                    header={{
                        title: labels.ledger_title,
                        subtitle: labels.ledger_rectification_note,
                        countLabel: labels.ledger_records.replace("{count}", rows.length.toString()),
                    }}
                    loading={loading}
                    loadingLabel={labels.error_load}
                    desktopFrom="lg"
                    toolbar={(
                        <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
                            <label className="relative min-w-0 flex-1">
                                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]" aria-hidden="true" />
                                <input
                                    value={search}
                                    onChange={(event) => setSearch(event.target.value)}
                                    placeholder={labels.ledger_search_placeholder}
                                    className="h-10 w-full rounded-xl border border-[var(--border-color)] bg-[var(--bg-card-solid)] py-2 pl-9 pr-3 text-sm text-[var(--text-main)] outline-none transition-colors placeholder:text-[var(--text-muted)] focus:border-accent"
                                />
                            </label>
                            <select
                                value={year}
                                onChange={(event) => setYear(event.target.value)}
                                aria-label={labels.ledger_all_years}
                                className="h-10 rounded-xl border border-[var(--border-color)] bg-[var(--bg-card-solid)] px-3 text-sm text-[var(--text-main)] outline-none transition-colors focus:border-accent"
                            >
                                <option value="">{labels.ledger_all_years}</option>
                                {years.map((availableYear) => <option key={availableYear} value={availableYear}>{availableYear}</option>)}
                            </select>
                            <div className="flex flex-wrap gap-2">
                                <button type="button" onClick={() => downloadCsv(INVOICE_SUMMARY_CSV_TEMPLATE, "plantilla-resumen-facturas.csv")} className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-[var(--border-color)] bg-[var(--bg-card-solid)] px-3 text-xs font-semibold text-[var(--text-main)] ui-motion hover:bg-[var(--bg-tertiary)]">
                                    <FileSpreadsheet className="h-3.5 w-3.5" /> Plantilla CSV
                                </button>
                                <button type="button" onClick={handleExportCsv} disabled={rows.length === 0} className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-[var(--border-color)] bg-[var(--bg-card-solid)] px-3 text-xs font-semibold text-[var(--text-main)] ui-motion hover:bg-[var(--bg-tertiary)] disabled:opacity-60">
                                    <Download className="h-3.5 w-3.5" /> Exportar
                                </button>
                            </div>
                        </div>
                    )}
                    empty={<p className="text-sm text-[var(--text-muted)]">{labels.ledger_empty}</p>}
                    rowAriaLabel={(row) => `${row.invoice.invoice_number}: ${row.clientName}`}
                    renderDesktopRow={(row) => (
                        <>
                            <span className="truncate font-mono text-xs font-semibold text-[var(--text-main)]">{row.invoice.invoice_number}</span>
                            <span className="text-xs text-[var(--text-muted)]">{formatDate(row.invoice.issue_date)}</span>
                            <span className="truncate text-xs font-semibold text-[var(--text-main)]">{row.clientName}</span>
                            <span className="text-right font-mono text-xs font-semibold text-[var(--text-main)]">{formatCurrency(row.invoice.total_amount)}</span>
                            <span className="text-right font-mono text-xs text-[var(--text-main)]">{formatCurrency(row.invoice.base_amount)}</span>
                            <span className="text-right font-mono text-xs text-[var(--text-main)]">{formatCurrency(row.invoice.tax_amount)}</span>
                            <span className={`w-fit rounded-full border px-2 py-0.5 text-[9px] font-semibold uppercase ${getStatusBadgeClass(row.invoice.status)}`}>{statusLabel(row.invoice)}</span>
                        </>
                    )}
                    renderCompactRow={(row) => (
                        <div className="space-y-3">
                            <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                    <p className="truncate font-mono text-xs font-semibold text-[var(--text-main)]">{row.invoice.invoice_number}</p>
                                    <p className="mt-1 truncate text-sm font-semibold text-[var(--text-main)]">{row.clientName}</p>
                                </div>
                                <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[9px] font-semibold uppercase ${getStatusBadgeClass(row.invoice.status)}`}>{statusLabel(row.invoice)}</span>
                            </div>
                            <div className="grid grid-cols-3 gap-2 text-xs">
                                <span><span className="block text-[10px] text-[var(--text-muted)]">{labels.ledger_base}</span><strong className="font-mono text-[var(--text-main)]">{formatCurrency(row.invoice.base_amount)}</strong></span>
                                <span><span className="block text-[10px] text-[var(--text-muted)]">{labels.ledger_vat}</span><strong className="font-mono text-[var(--text-main)]">{formatCurrency(row.invoice.tax_amount)}</strong></span>
                                <span><span className="block text-[10px] text-[var(--text-muted)]">{labels.ledger_total}</span><strong className="font-mono text-[var(--text-main)]">{formatCurrency(row.invoice.total_amount)}</strong></span>
                            </div>
                            <p className="text-[11px] text-[var(--text-muted)]">{formatDate(row.invoice.issue_date)}</p>
                        </div>
                    )}
                />
            </div>
        </div>
    );
}

function SummaryLoading({ label }: { label: string }) {
    return (
        <div className="flex h-full items-center justify-center gap-2 text-sm font-semibold text-[var(--text-muted)]">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            {label}
        </div>
    );
}
