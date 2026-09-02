"use client";

import { FileText } from "lucide-react";

import { DataTablePagination, useDataTablePagination } from "@/components/ui/data-table-pagination";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency, formatDate, formatInvoiceNumber } from "@/lib/format";
import type { Invoice } from "@/types/invoice";

type ClientDetailBillingTabProps = { invoices: Invoice[]; };
const STATUS_LABELS: Record<Invoice["status"], string> = { draft: "Borrador", issued: "Emitida", paid: "Cobrada", overdue: "Vencida", cancelled: "Anulada", rectified: "Rectificada" };

export function ClientDetailBillingTab({ invoices }: ClientDetailBillingTabProps) {
    const pagination = useDataTablePagination(invoices, 10);
    return <section className="billing-surface overflow-hidden rounded-[22px]">
        <header className="flex items-center justify-between gap-3 px-5 py-4"><div><h3 className="text-sm font-semibold text-[var(--text-main)]">Facturación</h3><p className="mt-1 text-xs text-[var(--text-muted)]">Facturas asociadas a este cliente.</p></div><p className="text-sm font-medium text-[var(--text-muted)]">{invoices.length} {invoices.length === 1 ? "factura" : "facturas"}</p></header>
        {invoices.length === 0 ? <div className="px-5 py-16 text-center"><FileText className="mx-auto size-8 text-[var(--text-muted)]" /><p className="mt-3 text-sm text-[var(--text-muted)]">No hay facturas de este cliente.</p></div> : <><Table className="min-w-[36rem] table-fixed text-left"><TableHeader><TableRow className="bg-[var(--bg-secondary)]/40 text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--btn-secondary-text)]"><TableHead className="w-[32%] text-[var(--btn-secondary-text)]">Factura</TableHead><TableHead className="w-[23%] text-[var(--btn-secondary-text)]">Fecha</TableHead><TableHead className="w-[23%] text-right text-[var(--btn-secondary-text)]">Total</TableHead><TableHead className="w-[22%] text-right text-[var(--btn-secondary-text)]">Estado</TableHead></TableRow></TableHeader><TableBody>{pagination.pageItems.map((invoice) => <TableRow key={invoice.id} className="bg-[var(--bg-secondary)]/20"><TableCell className="font-mono text-sm font-semibold text-accent">{formatInvoiceNumber(invoice.invoice_number)}</TableCell><TableCell className="text-xs text-[var(--text-muted)]">{formatDate(invoice.issue_date)}</TableCell><TableCell className="text-right font-mono text-sm font-semibold text-[var(--text-main)]">{formatCurrency(invoice.total_amount)}</TableCell><TableCell className="text-right text-xs font-medium text-[var(--text-muted)]">{STATUS_LABELS[invoice.status]}</TableCell></TableRow>)}</TableBody></Table><DataTablePagination page={pagination.page} totalItems={invoices.length} pageSize={pagination.pageSize} onPageChange={pagination.setPage} onPageSizeChange={pagination.setPageSize} summary={`${(pagination.page - 1) * pagination.pageSize + 1}-${Math.min(pagination.page * pagination.pageSize, invoices.length)} de ${invoices.length} facturas`} rowsPerPageLabel="Filas por página" previousLabel="Página anterior" nextLabel="Página siguiente" /></>}
    </section>;
}
