"use client";

import { Edit3, Eye, FileText, Loader2 } from "lucide-react";
import { getStatusBadgeClass } from "@/components/invoices/invoice-status-utils";
import { ActionPopover } from "@/components/ui/action-popover";
import { Button } from "@/components/ui/button";
import { DataTablePagination, useDataTablePagination } from "@/components/ui/data-table-pagination";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency, formatDate, formatInvoiceNumber } from "@/lib/format";
import type { Invoice } from "@/types/invoice";

type InvoicesListSectionProps = {
    invoices: Invoice[]; loading: boolean; loadingLabel: string; emptyLabel: string;
    getClientName: (clientId: number) => string;
    getStatusText: (status: Invoice["status"]) => string;
    onOpenInvoice: (invoiceId: number) => void;
    labels: { rectification: string; issue_date: string; due_date: string; client: string; total: string; status: string; actions: string };
};

function getInvoiceActions(invoice: Invoice, onOpenInvoice: (invoiceId: number) => void) {
    return [{ label: "Ver detalle", icon: Eye, onClick: () => onOpenInvoice(invoice.id) }, ...(invoice.status === "draft" ? [{ label: "Editar", icon: Edit3, onClick: () => onOpenInvoice(invoice.id), variant: "edit" as const }] : [])];
}

export function InvoicesListSection({ invoices, loading, loadingLabel, emptyLabel, getClientName, getStatusText, onOpenInvoice, labels }: InvoicesListSectionProps) {
    const pagination = useDataTablePagination(invoices, 10);

    if (loading) return <section className="billing-surface flex min-h-64 items-center justify-center gap-3 rounded-[26px]"><Loader2 className="size-6 animate-spin text-accent" /><span className="text-xs text-[var(--text-muted)]">{loadingLabel}</span></section>;

    return <section className="billing-surface overflow-hidden rounded-[26px]">
        <header className="px-5 py-4"><h2 className="text-sm font-semibold text-[var(--text-main)]">Facturas registradas</h2><p className="mt-1 text-xs text-[var(--text-muted)]">Pulsa una fila para abrir el detalle, descargar o enviar.</p></header>
        {invoices.length === 0 ? <div className="px-5 py-16 text-center"><FileText className="mx-auto size-8 text-[var(--btn-secondary-text)]" /><h3 className="mt-3 text-sm font-semibold text-[var(--text-main)]">No hay facturas que mostrar</h3><p className="mx-auto mt-1 max-w-md text-xs leading-5 text-[var(--text-muted)]">{emptyLabel}</p></div> : <>
            <div className="space-y-2.5 p-3 md:hidden">{pagination.pageItems.map((invoice) => <Button key={invoice.id} type="button" variant="ghost" onClick={() => onOpenInvoice(invoice.id)} className="billing-block h-auto w-full justify-start rounded-2xl p-3 text-left hover:translate-y-0 hover:shadow-none"><span className="min-w-0 flex-1"><span className="flex items-center justify-between gap-3"><span className="min-w-0"><span className="block font-mono text-sm font-semibold text-accent">{formatInvoiceNumber(invoice.invoice_number)}</span><span className="mt-1 block truncate text-sm font-semibold text-[var(--text-main)]">{getClientName(invoice.client_id)}</span></span><span className={`rounded-full border px-2 py-0.5 text-[9px] font-semibold uppercase ${getStatusBadgeClass(invoice.status)}`}>{getStatusText(invoice.status)}</span></span><span className="mt-2 block border-t border-[var(--border-soft)] pt-2 text-xs text-[var(--text-muted)]">{formatDate(invoice.issue_date)} · <span className="font-mono font-semibold text-[var(--text-main)]">{formatCurrency(invoice.total_amount)}</span></span></span></Button>)}</div>
            <div className="hidden overflow-x-auto p-3 md:block"><Table className="min-w-[760px] table-fixed text-left"><colgroup><col className="w-[25%]" /><col className="w-[19%]" /><col className="w-[20%]" /><col className="w-[12%]" /><col className="w-[15%]" /><col className="w-[9%]" /></colgroup><TableHeader><TableRow className="bg-[var(--bg-secondary)]/40 text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--text-muted)]"><TableHead className="text-[var(--btn-secondary-text)]">Documento</TableHead><TableHead className="text-[var(--btn-secondary-text)]">{labels.client}</TableHead><TableHead className="text-[var(--btn-secondary-text)]">{labels.issue_date}</TableHead><TableHead className="text-right text-[var(--btn-secondary-text)]">{labels.total}</TableHead><TableHead className="text-[var(--btn-secondary-text)]">{labels.status}</TableHead><TableHead className="text-right text-[var(--btn-secondary-text)]">{labels.actions}</TableHead></TableRow></TableHeader><TableBody>{pagination.pageItems.map((invoice) => <TableRow key={invoice.id} className="cursor-pointer border-b border-[var(--border-soft)] bg-[var(--bg-secondary)]/20 hover:bg-[var(--bg-secondary)]/55" onClick={() => onOpenInvoice(invoice.id)}><TableCell><div className="flex items-center gap-2"><FileText className="size-4 shrink-0 text-[var(--btn-secondary-text)]" /><Button type="button" variant="link" onClick={(event) => { event.stopPropagation(); onOpenInvoice(invoice.id); }} className="h-auto border-0 bg-transparent p-0 font-mono text-sm font-semibold text-accent shadow-none hover:bg-transparent hover:shadow-none">{formatInvoiceNumber(invoice.invoice_number)}</Button></div>{invoice.is_rectification && <span className="mt-1 inline-flex rounded-full border border-[var(--btn-cancel-border)] bg-[var(--btn-cancel-bg)] px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-[var(--btn-cancel-text)]">{labels.rectification}</span>}</TableCell><TableCell className="truncate font-semibold text-[var(--text-main)]">{getClientName(invoice.client_id)}</TableCell><TableCell className="text-xs text-[var(--text-muted)]"><span className="block text-[var(--text-main)]">{formatDate(invoice.issue_date)}</span>{invoice.due_date && <span className="mt-0.5 block text-[11px]">Vence {formatDate(invoice.due_date)}</span>}</TableCell><TableCell className="text-right font-mono text-sm font-semibold text-[var(--text-main)]">{formatCurrency(invoice.total_amount)}</TableCell><TableCell><span className={`inline-flex rounded-full border px-2.5 py-0.5 text-[10px] font-semibold uppercase ${getStatusBadgeClass(invoice.status)}`}>{getStatusText(invoice.status)}</span></TableCell><TableCell className="text-right" onClick={(event) => event.stopPropagation()}><ActionPopover align="end" options={getInvoiceActions(invoice, onOpenInvoice)} /></TableCell></TableRow>)}</TableBody></Table></div>
            <DataTablePagination page={pagination.page} totalItems={invoices.length} pageSize={pagination.pageSize} onPageChange={pagination.setPage} onPageSizeChange={pagination.setPageSize} summary={`${(pagination.page - 1) * pagination.pageSize + 1}-${Math.min(pagination.page * pagination.pageSize, invoices.length)} de ${invoices.length} facturas`} rowsPerPageLabel="Filas por página" previousLabel="Página anterior" nextLabel="Página siguiente" />
        </>}
    </section>;
}
