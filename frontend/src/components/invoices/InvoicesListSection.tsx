"use client";

import Link from "next/link";
import { ChevronRight, Eye, FileText, Loader2 } from "lucide-react";
import type { KeyboardEvent } from "react";

import { getStatusBadgeClass } from "@/components/invoices/invoice-status-utils";
import { ActionPopover } from "@/components/ui/action-popover";
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

function InvoiceRow({
    invoice,
    getClientName,
    getStatusText,
    labels,
    onOpenInvoice,
    compact = false,
}: Pick<InvoicesListSectionProps, "getClientName" | "getStatusText" | "labels" | "onOpenInvoice"> & {
    invoice: Invoice;
    compact?: boolean;
}) {
    const openWithKeyboard = (event: KeyboardEvent<HTMLDivElement>) => {
        if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            onOpenInvoice(invoice.id);
        }
    };

    return (
        <div
            role="button"
            tabIndex={0}
            aria-label={`Abrir factura ${formatInvoiceNumber(invoice.invoice_number)}`}
            onClick={() => onOpenInvoice(invoice.id)}
            onKeyDown={openWithKeyboard}
            className={compact
                ? "group cursor-pointer rounded-2xl border border-[var(--border-soft)] bg-[var(--bg-card-solid)] p-4 shadow-sm transition hover:border-[var(--btn-secondary-border)] hover:shadow-md active:scale-[0.995]"
                : "group grid cursor-pointer grid-cols-[minmax(11rem,1.2fr)_minmax(10rem,1fr)_minmax(9rem,.8fr)_minmax(8rem,.7fr)_minmax(7.5rem,.6fr)_auto] items-center gap-4 border-t border-[var(--border-soft)] px-5 py-4 transition hover:bg-[var(--btn-secondary-bg)]/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/35"
            }
        >
            {compact ? (
                <>
                    <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                                <Link
                                    href={`/dashboard/invoices/${invoice.id}`}
                                    onClick={(event) => event.stopPropagation()}
                                    className="font-mono text-sm font-black text-accent hover:underline"
                                >
                                    {formatInvoiceNumber(invoice.invoice_number)}
                                </Link>
                                <span className={`inline-flex rounded-full border px-2 py-0.5 text-[9px] font-black uppercase ${getStatusBadgeClass(invoice.status)}`}>
                                    {getStatusText(invoice.status)}
                                </span>
                            </div>
                            <p className="mt-2 truncate text-sm font-black text-[var(--text-main)]">{getClientName(invoice.client_id)}</p>
                        </div>
                        <div className="flex shrink-0 items-center gap-1" onClick={(event) => event.stopPropagation()}>
                            <ActionPopover
                                align="end"
                                options={[{ label: "Ver detalle", icon: Eye, href: `/dashboard/invoices/${invoice.id}` }]}
                            />
                            <ChevronRight className="h-4 w-4 text-[var(--text-muted)]" aria-hidden="true" />
                        </div>
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 border-t border-[var(--border-soft)] pt-3 text-xs">
                        <p className="text-[var(--text-muted)]">
                            <span className="block text-[10px] font-black uppercase tracking-wide">{labels.issue_date}</span>
                            <span className="mt-1 block">{formatDate(invoice.issue_date)}</span>
                        </p>
                        <p className="text-right text-[var(--text-muted)]">
                            <span className="block text-[10px] font-black uppercase tracking-wide">{labels.total}</span>
                            <span className="mt-1 block font-mono text-sm font-black text-[var(--text-main)]">{formatCurrency(invoice.total_amount)}</span>
                        </p>
                    </div>
                </>
            ) : (
                <>
                    <div className="min-w-0">
                        <div className="flex items-center gap-2">
                            <FileText className="h-4 w-4 shrink-0 text-[var(--btn-secondary-text)]" aria-hidden="true" />
                            <Link
                                href={`/dashboard/invoices/${invoice.id}`}
                                onClick={(event) => event.stopPropagation()}
                                className="truncate font-mono text-sm font-black text-accent hover:underline"
                            >
                                {formatInvoiceNumber(invoice.invoice_number)}
                            </Link>
                        </div>
                        {invoice.is_rectification && (
                            <span className="mt-1.5 inline-flex rounded-full border border-[var(--btn-cancel-border)] bg-[var(--btn-cancel-bg)] px-2 py-0.5 text-[9px] font-black uppercase tracking-wide text-[var(--btn-cancel-text)]">
                                {labels.rectification}
                            </span>
                        )}
                    </div>
                    <p className="truncate text-sm font-semibold text-[var(--text-main)]">{getClientName(invoice.client_id)}</p>
                    <div className="text-xs text-[var(--text-muted)]">
                        <span className="block">{formatDate(invoice.issue_date)}</span>
                        {invoice.due_date && <span className="mt-1 block text-[11px]">{labels.due_date}: {formatDate(invoice.due_date)}</span>}
                    </div>
                    <p className="font-mono text-sm font-black text-[var(--text-main)]">{formatCurrency(invoice.total_amount)}</p>
                    <div>
                        <span className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-black uppercase ${getStatusBadgeClass(invoice.status)}`}>
                            {getStatusText(invoice.status)}
                        </span>
                    </div>
                    <div className="flex items-center justify-end gap-2" onClick={(event) => event.stopPropagation()}>
                        <ActionPopover
                            align="end"
                            options={[{ label: "Ver detalle", icon: Eye, href: `/dashboard/invoices/${invoice.id}` }]}
                        />
                        <ChevronRight className="h-4 w-4 text-[var(--text-muted)] transition group-hover:translate-x-0.5 group-hover:text-[var(--text-main)]" aria-hidden="true" />
                    </div>
                </>
            )}
        </div>
    );
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
    if (loading) {
        return (
            <div className="billing-surface flex flex-col items-center justify-center gap-3 rounded-[26px] py-20">
                <Loader2 className="h-8 w-8 animate-spin text-accent" />
                <span className="text-xs text-[var(--text-muted)]">{loadingLabel}</span>
            </div>
        );
    }

    if (invoices.length === 0) {
        return (
            <section className="billing-surface rounded-[26px] border-dashed border-[var(--border-color)] px-5 py-16 text-center">
                <FileText className="mx-auto h-8 w-8 text-[var(--btn-secondary-text)]" aria-hidden="true" />
                <h2 className="mt-3 text-sm font-black text-[var(--text-main)]">No hay facturas que mostrar</h2>
                <p className="mx-auto mt-1 max-w-md text-xs leading-5 text-[var(--text-muted)]">{emptyLabel}</p>
            </section>
        );
    }

    return (
        <section className="billing-surface overflow-hidden rounded-[26px]">
            <header className="flex flex-col gap-3 border-b border-[var(--border-soft)] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h2 className="text-sm font-black text-[var(--text-main)]">Facturas registradas</h2>
                    <p className="mt-1 text-xs text-[var(--text-muted)]">Abre una factura para revisar su estado, descargarla o enviarla.</p>
                </div>
                <span className="w-fit rounded-full border border-[var(--btn-neutral-border)] bg-[var(--btn-neutral-bg)] px-3 py-1 text-xs font-black text-[var(--text-main)]">
                    {invoices.length} {invoices.length === 1 ? "factura" : "facturas"}
                </span>
            </header>

            <div className="space-y-3 p-3 md:hidden">
                {invoices.map((invoice) => (
                    <InvoiceRow
                        key={invoice.id}
                        compact
                        invoice={invoice}
                        getClientName={getClientName}
                        getStatusText={getStatusText}
                        labels={labels}
                        onOpenInvoice={onOpenInvoice}
                    />
                ))}
            </div>

            <div className="hidden md:block">
                <div className="grid grid-cols-[minmax(11rem,1.2fr)_minmax(10rem,1fr)_minmax(9rem,.8fr)_minmax(8rem,.7fr)_minmax(7.5rem,.6fr)_auto] gap-4 bg-[var(--bg-secondary)] px-5 py-3 text-[10px] font-black uppercase tracking-[0.12em] text-[var(--text-muted)]">
                    <span>Documento</span>
                    <span>{labels.client}</span>
                    <span>{labels.issue_date}</span>
                    <span>{labels.total}</span>
                    <span>{labels.status}</span>
                    <span className="text-right">{labels.actions}</span>
                </div>
                {invoices.map((invoice) => (
                    <InvoiceRow
                        key={invoice.id}
                        invoice={invoice}
                        getClientName={getClientName}
                        getStatusText={getStatusText}
                        labels={labels}
                        onOpenInvoice={onOpenInvoice}
                    />
                ))}
            </div>
        </section>
    );
}
