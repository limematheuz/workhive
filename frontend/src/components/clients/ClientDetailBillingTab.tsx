"use client";

import { FileText } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { DataListTable } from "@/components/ui/data-list-table";
import { DataTablePagination, useDataTablePagination } from "@/components/ui/data-table-pagination";
import { formatCurrency, formatDate, formatInvoiceNumber } from "@/lib/format";
import type { Invoice } from "@/types/invoice";

type ClientDetailBillingTabProps = { invoices: Invoice[]; };
const STATUS_LABELS: Record<Invoice["status"], string> = { draft: "Borrador", issued: "Emitida", paid: "Cobrada", overdue: "Vencida", cancelled: "Anulada", rectified: "Rectificada" };

export function ClientDetailBillingTab({ invoices }: ClientDetailBillingTabProps) {
    const pagination = useDataTablePagination(invoices, 10);
    return <section className="billing-surface overflow-hidden rounded-[22px]">
        <header className="flex items-center justify-between gap-3 px-5 py-4"><div><h3 className="text-sm font-semibold text-[var(--text-main)]">Facturación</h3><p className="mt-1 text-xs text-[var(--text-muted)]">Facturas asociadas a este cliente.</p></div><p className="text-sm font-medium text-[var(--text-muted)]">{invoices.length} {invoices.length === 1 ? "factura" : "facturas"}</p></header>
        {invoices.length === 0 ? <div className="px-5 py-16 text-center"><FileText className="mx-auto size-8 text-[var(--text-muted)]" /><p className="mt-3 text-sm text-[var(--text-muted)]">No hay facturas de este cliente.</p></div> : <DataListTable variant="plain" desktopFrom="lg" items={pagination.pageItems} getRowKey={(invoice) => invoice.id} columns={[{ key: "invoice", label: "Factura" }, { key: "date", label: "Fecha" }, { key: "total", label: "Total", className: "text-right" }, { key: "status", label: "Estado", className: "text-right" }]} gridClassName="grid-cols-[minmax(9rem,1.2fr)_minmax(7rem,.8fr)_minmax(7rem,.8fr)_minmax(7rem,.8fr)]" renderDesktopRow={(invoice) => <><span className="font-mono text-sm font-semibold text-accent">{formatInvoiceNumber(invoice.invoice_number)}</span><span className="text-xs text-[var(--text-muted)]">{formatDate(invoice.issue_date)}</span><span className="text-right font-mono text-sm font-semibold text-[var(--text-main)]">{formatCurrency(invoice.total_amount)}</span><span className="text-right text-xs font-medium text-[var(--text-muted)]">{STATUS_LABELS[invoice.status]}</span></>} renderCompactRow={(invoice) => <div className="flex items-start justify-between gap-3"><div><p className="font-mono text-sm font-semibold text-accent">{formatInvoiceNumber(invoice.invoice_number)}</p><p className="mt-1 text-xs text-[var(--text-muted)]">{formatDate(invoice.issue_date)}</p></div><div className="text-right"><p className="font-mono text-sm font-semibold text-[var(--text-main)]">{formatCurrency(invoice.total_amount)}</p><Badge className="mt-1 border border-[var(--border-soft)] bg-[var(--bg-tertiary)] text-[10px] text-[var(--text-muted)]">{STATUS_LABELS[invoice.status]}</Badge></div></div>} footer={<DataTablePagination page={pagination.page} totalItems={invoices.length} pageSize={pagination.pageSize} onPageChange={pagination.setPage} onPageSizeChange={pagination.setPageSize} summary={`${(pagination.page - 1) * pagination.pageSize + 1}-${Math.min(pagination.page * pagination.pageSize, invoices.length)} de ${invoices.length} facturas`} rowsPerPageLabel="Filas por página" previousLabel="Página anterior" nextLabel="Página siguiente" />} />}
    </section>;
}
