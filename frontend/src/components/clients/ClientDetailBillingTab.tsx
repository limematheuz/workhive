"use client";

import { FileText } from "lucide-react";

import { DataListTable } from "@/components/ui/data-list-table";
import { formatCurrency, formatDate, formatInvoiceNumber } from "@/lib/format";
import type { Invoice } from "@/types/invoice";

type ClientDetailBillingTabProps = {
    invoices: Invoice[];
};

const STATUS_LABELS: Record<Invoice["status"], string> = {
    draft: "Borrador",
    issued: "Emitida",
    paid: "Cobrada",
    overdue: "Vencida",
    cancelled: "Anulada",
    rectified: "Rectificada",
};

export function ClientDetailBillingTab({ invoices }: ClientDetailBillingTabProps) {
    return (
        <DataListTable
            variant="plain"
            items={invoices}
            getRowKey={(invoice) => invoice.id}
            gridClassName="grid-cols-[minmax(10rem,1fr)_7rem_7rem_7rem]"
            header={{
                title: "Facturación",
                subtitle: "Facturas asociadas a este cliente.",
                countLabel: `${invoices.length} ${invoices.length === 1 ? "factura" : "facturas"}`,
            }}
            columns={[
                { key: "invoice", label: "Factura" },
                { key: "date", label: "Fecha" },
                { key: "total", label: "Total", className: "text-right" },
                { key: "status", label: "Estado", className: "text-right" },
            ]}
            empty={(
                <><FileText className="mx-auto h-8 w-8 text-[var(--text-muted)]" aria-hidden="true" /><p className="mt-3 text-sm text-[var(--text-muted)]">No hay facturas de este cliente.</p></>
            )}
            renderCompactRow={(invoice) => (
                <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0"><p className="truncate font-mono text-sm font-semibold text-accent">{formatInvoiceNumber(invoice.invoice_number)}</p><p className="mt-1 text-xs text-[var(--text-muted)]">{formatDate(invoice.issue_date)}</p></div>
                    <div className="text-right"><p className="font-mono text-sm font-semibold text-[var(--text-main)]">{formatCurrency(invoice.total_amount)}</p><p className="mt-1 text-[10px] text-[var(--text-muted)]">{STATUS_LABELS[invoice.status]}</p></div>
                </div>
            )}
            renderDesktopRow={(invoice) => (
                <><span className="font-mono text-sm font-semibold text-accent">{formatInvoiceNumber(invoice.invoice_number)}</span><span className="text-xs text-[var(--text-muted)]">{formatDate(invoice.issue_date)}</span><span className="text-right font-mono text-sm font-semibold text-[var(--text-main)]">{formatCurrency(invoice.total_amount)}</span><span className="text-right text-xs font-medium text-[var(--text-muted)]">{STATUS_LABELS[invoice.status]}</span></>
            )}
        />
    );
}
