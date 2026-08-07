"use client";

import { Edit3, Eye, FileText } from "lucide-react";

import { getStatusBadgeClass } from "@/components/invoices/invoice-status-utils";
import { ActionPopover } from "@/components/ui/action-popover";
import { DataListTable } from "@/components/ui/data-list-table";
import { formatCurrency, formatDate, formatInvoiceNumber } from "@/lib/format";
import type { Invoice } from "@/types/invoice";

type InvoicesListSectionProps = {
    invoices: Invoice[];
    loading: boolean;
    loadingLabel: string;
    emptyLabel: string;
    getClientName: (clientId: number) => string;
    getStatusText: (status: Invoice["status"]) => string;
    onOpenInvoice: (invoiceId: number) => void;
    labels: {
        rectification: string;
        issue_date: string;
        due_date: string;
        client: string;
        total: string;
        status: string;
        actions: string;
    };
};

const GRID =
    "grid-cols-[minmax(11rem,1.2fr)_minmax(10rem,1fr)_minmax(10rem,.9fr)_minmax(7rem,.65fr)_7.5rem_5.5rem]";

function getInvoiceActions(invoice: Invoice, onOpenInvoice: (invoiceId: number) => void) {
    return [
        {
            label: "Ver detalle",
            icon: Eye,
            onClick: () => onOpenInvoice(invoice.id),
        },
        ...(invoice.status === "draft"
            ? [{
                label: "Editar",
                icon: Edit3,
                onClick: () => onOpenInvoice(invoice.id),
                variant: "edit" as const,
            }]
            : []),
    ];
}

export function InvoicesListSection({
    invoices,
    loading,
    loadingLabel,
    emptyLabel,
    getClientName,
    getStatusText,
    onOpenInvoice,
    labels,
}: InvoicesListSectionProps) {
    return (
        <DataListTable
            items={invoices}
            getRowKey={(invoice) => invoice.id}
            loading={loading}
            loadingLabel={loadingLabel}
            gridClassName={GRID}
            onRowClick={(invoice) => onOpenInvoice(invoice.id)}
            rowAriaLabel={(invoice) => `Abrir factura ${formatInvoiceNumber(invoice.invoice_number)}`}
            header={{
                title: "Facturas registradas",
                subtitle: "Pulsa una fila para abrir el detalle, descargar o enviar.",
                countLabel: `${invoices.length} ${invoices.length === 1 ? "factura" : "facturas"}`,
            }}
            columns={[
                { key: "document", label: "Documento" },
                { key: "client", label: labels.client },
                { key: "issue", label: labels.issue_date },
                { key: "total", label: labels.total },
                { key: "status", label: labels.status },
                { key: "actions", label: labels.actions, className: "text-right" },
            ]}
            empty={(
                <>
                    <FileText className="mx-auto h-8 w-8 text-[var(--btn-secondary-text)]" aria-hidden="true" />
                    <h2 className="mt-3 text-sm font-semibold text-[var(--text-main)]">No hay facturas que mostrar</h2>
                    <p className="mx-auto mt-1 max-w-md text-xs leading-5 text-[var(--text-muted)]">{emptyLabel}</p>
                </>
            )}
            renderCompactRow={(invoice) => (
                <>
                    <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                            <button
                                type="button"
                                onClick={(event) => {
                                    event.stopPropagation()
                                    onOpenInvoice(invoice.id)
                                }}
                                className="font-mono text-sm font-semibold text-accent hover:underline"
                            >
                                {formatInvoiceNumber(invoice.invoice_number)}
                            </button>
                                <span className={`inline-flex rounded-full border px-2 py-0.5 text-[9px] font-semibold uppercase ${getStatusBadgeClass(invoice.status)}`}>
                                    {getStatusText(invoice.status)}
                                </span>
                            </div>
                            <p className="mt-1.5 truncate text-sm font-semibold text-[var(--text-main)]">{getClientName(invoice.client_id)}</p>
                        </div>
                        <div className="flex shrink-0 items-center" onClick={(event) => event.stopPropagation()}>
                            <ActionPopover align="end" options={getInvoiceActions(invoice, onOpenInvoice)} />
                        </div>
                    </div>
                    <div className="mt-2.5 grid grid-cols-2 gap-x-3 gap-y-1.5 border-t border-[var(--border-soft)] pt-2.5 text-xs">
                        <p className="text-[var(--text-muted)]">
                            <span className="block text-[10px] font-semibold uppercase tracking-wide">{labels.issue_date}</span>
                            <span className="mt-0.5 block">{formatDate(invoice.issue_date)}</span>
                            {invoice.due_date && (
                                <span className="mt-0.5 block text-[11px]">Vence {formatDate(invoice.due_date)}</span>
                            )}
                        </p>
                        <p className="text-right text-[var(--text-muted)]">
                            <span className="block text-[10px] font-semibold uppercase tracking-wide">{labels.total}</span>
                            <span className="mt-0.5 block font-mono text-sm font-semibold text-[var(--text-main)]">{formatCurrency(invoice.total_amount)}</span>
                        </p>
                    </div>
                </>
            )}
            renderDesktopRow={(invoice) => (
                <>
                    <div className="min-w-0">
                        <div className="flex items-center gap-2">
                            <FileText className="h-4 w-4 shrink-0 text-[var(--btn-secondary-text)]" aria-hidden="true" />
                            <button
                                type="button"
                                onClick={() => onOpenInvoice(invoice.id)}
                                className="truncate font-mono text-sm font-semibold text-accent hover:underline"
                            >
                                {formatInvoiceNumber(invoice.invoice_number)}
                            </button>
                        </div>
                        {invoice.is_rectification && (
                            <span className="mt-1 inline-flex rounded-full border border-[var(--btn-cancel-border)] bg-[var(--btn-cancel-bg)] px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-[var(--btn-cancel-text)]">
                                {labels.rectification}
                            </span>
                        )}
                    </div>
                    <p className="truncate text-sm font-semibold text-[var(--text-main)]">{getClientName(invoice.client_id)}</p>
                    <div className="min-w-0 text-xs leading-tight text-[var(--text-muted)]">
                        <span className="block truncate tabular-nums text-[var(--text-main)]">{formatDate(invoice.issue_date)}</span>
                        {invoice.due_date && (
                            <span className="mt-0.5 block truncate text-[11px]">Vence {formatDate(invoice.due_date)}</span>
                        )}
                    </div>
                    <p className="font-mono text-sm font-semibold text-[var(--text-main)]">{formatCurrency(invoice.total_amount)}</p>
                    <div>
                        <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-[10px] font-semibold uppercase ${getStatusBadgeClass(invoice.status)}`}>
                            {getStatusText(invoice.status)}
                        </span>
                    </div>
                    <div className="flex items-center justify-end" onClick={(event) => event.stopPropagation()}>
                        <ActionPopover align="end" options={getInvoiceActions(invoice, onOpenInvoice)} />
                    </div>
                </>
            )}
        />
    );
}
