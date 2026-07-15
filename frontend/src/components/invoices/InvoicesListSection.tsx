"use client";

import Link from "next/link";
import { Eye, Loader2 } from "lucide-react";

import { getStatusBadgeClass } from "@/components/invoices/invoice-status-utils";
import { ActionPopover } from "@/components/ui/action-popover";
import { formatCurrency, formatDate, formatInvoiceNumber } from "@/lib/format";
import type { Invoice } from "@/types/invoice";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";

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
            <div className="flex flex-col items-center justify-center py-20 gap-3">
                <Loader2 className="w-8 h-8 text-accent animate-spin" />
                <span className="text-xs text-[var(--text-muted)]">{loadingLabel}</span>
            </div>
        );
    }

    if (invoices.length === 0) {
        return (
            <div className="text-center py-20 surface-glass-card rounded-2xl">
                <p className="text-sm text-[var(--text-muted)]">{emptyLabel}</p>
            </div>
        );
    }

    return (
        <>
            <div className="lg:hidden space-y-3">
                {invoices.map((invoice) => (
                    <div
                        key={invoice.id}
                        role="button"
                        tabIndex={0}
                        aria-label={`Open invoice ${formatInvoiceNumber(invoice.invoice_number)}`}
                        onClick={() => onOpenInvoice(invoice.id)}
                        onKeyDown={(event) => {
                            if (event.key === "Enter" || event.key === " ") {
                                event.preventDefault();
                                onOpenInvoice(invoice.id);
                            }
                        }}
                        className="surface-glass-card rounded-2xl p-4 space-y-3 cursor-pointer hover:border-[var(--border-color)] transition-colors active:scale-[0.99]"
                    >
                        <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                    <span className="text-xs font-mono font-bold text-accent">{formatInvoiceNumber(invoice.invoice_number)}</span>
                                    <span className={`inline-block px-2.5 py-0.5 rounded-full text-[9px] font-bold uppercase ${getStatusBadgeClass(invoice.status)}`}>
                                        {getStatusText(invoice.status)}
                                    </span>
                                    {invoice.is_rectification && (
                                        <span className="bg-rose-500/10 text-rose-500 text-[8px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wide border border-rose-500/20">
                                            {labels.rectification}
                                        </span>
                                    )}
                                </div>
                                <span className="text-sm font-black text-[var(--text-main)] mt-1 block truncate">
                                    {getClientName(invoice.client_id)}
                                </span>
                            </div>
                            <div onClick={(e) => e.stopPropagation()}>
                                <ActionPopover
                                    align="end"
                                    options={[
                                        {
                                            label: "Ver detalle",
                                            icon: Eye,
                                            href: `/dashboard/invoices/${invoice.id}`,
                                        },
                                    ]}
                                />
                            </div>
                        </div>

                        <div className="space-y-1.5 pt-2 border-t border-[var(--border-soft)]/50">
                            <div className="flex items-center justify-between text-xs text-[var(--text-muted)]">
                                <span>{labels.issue_date}: {formatDate(invoice.issue_date)}</span>
                                {invoice.due_date && (
                                    <span>{labels.due_date}: {formatDate(invoice.due_date)}</span>
                                )}
                            </div>
                            <div className="flex items-center justify-end pt-1">
                                <span className="text-sm font-black text-[var(--text-main)]">{formatCurrency(invoice.total_amount)}</span>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            <div className="hidden lg:block surface-glass-card rounded-2xl overflow-hidden">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Nº</TableHead>
                            <TableHead>{labels.client}</TableHead>
                            <TableHead>{labels.issue_date}</TableHead>
                            <TableHead>{labels.due_date}</TableHead>
                            <TableHead className="text-right">{labels.total}</TableHead>
                            <TableHead className="text-center">{labels.status}</TableHead>
                            <TableHead className="text-center">{labels.actions}</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {invoices.map((invoice) => (
                            <TableRow key={invoice.id}>
                                <TableCell className="font-semibold">
                                    <Link
                                        href={`/dashboard/invoices/${invoice.id}`}
                                        className="text-accent hover:underline font-mono"
                                    >
                                        {formatInvoiceNumber(invoice.invoice_number)}
                                    </Link>
                                    {invoice.is_rectification && (
                                        <span className="ml-2 bg-rose-500/10 text-rose-500 text-[8px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wide border border-rose-500/20">
                                            {labels.rectification}
                                        </span>
                                    )}
                                </TableCell>
                                <TableCell className="text-[var(--text-muted)] font-medium">
                                    {getClientName(invoice.client_id)}
                                </TableCell>
                                <TableCell className="text-[var(--text-muted)]">
                                    {formatDate(invoice.issue_date)}
                                </TableCell>
                                <TableCell className="text-[var(--text-muted)]">
                                    {invoice.due_date ? formatDate(invoice.due_date) : "-"}
                                </TableCell>
                                <TableCell className="text-right font-bold text-[var(--text-main)]">
                                    {formatCurrency(invoice.total_amount)}
                                </TableCell>
                                <TableCell className="text-center">
                                    <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold ${getStatusBadgeClass(invoice.status)}`}>
                                        {getStatusText(invoice.status)}
                                    </span>
                                </TableCell>
                                <TableCell className="text-center">
                                    <div className="flex justify-center">
                                        <ActionPopover
                                            align="end"
                                            options={[
                                                {
                                                    label: "Ver detalle",
                                                    icon: Eye,
                                                    href: `/dashboard/invoices/${invoice.id}`,
                                                },
                                            ]}
                                        />
                                    </div>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>
        </>
    );
}
