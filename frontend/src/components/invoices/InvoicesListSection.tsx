"use client";

import { Edit3, Eye, FileText } from "lucide-react";
import { getStatusBadgeClass } from "@/components/invoices/invoice-status-utils";
import { ActionPopover } from "@/components/ui/action-popover";
import { Button } from "@/components/ui/button";
import { DataListTable } from "@/components/ui/data-list-table";
import { formatCurrency, formatDate, formatInvoiceNumber } from "@/lib/format";
import { financeLocalDay, invoiceOutstandingCents, isInvoiceOverdue } from "@/lib/finance-priorities";
import type { Invoice } from "@/types/invoice";

export const INVOICE_TABLE_KEY = "invoices.records";
type Props = {
 invoices: Invoice[]; loading: boolean; loadingLabel: string; emptyLabel: string;
 getClientName: (clientId: number) => string; getStatusText: (status: Invoice["status"]) => string;
 onOpenInvoice: (invoiceId: number, intent?: "view" | "edit") => void;
 labels: { rectification: string; issue_date: string; due_date: string; client: string; total: string; status: string; actions: string }; canManage: boolean;
};
export function InvoicesListSection({ invoices, loading, loadingLabel, emptyLabel, getClientName, getStatusText, onOpenInvoice, labels, canManage }: Props) {
 const asOf = financeLocalDay(new Date());
 const status = (invoice: Invoice) => <span className={`inline-flex rounded-full border px-2 py-1 text-xs font-medium ${getStatusBadgeClass(isInvoiceOverdue(invoice, asOf) ? "overdue" : invoice.status)}`}>{isInvoiceOverdue(invoice, asOf) ? "Vencida" : getStatusText(invoice.status)}</span>;
 const identity = (invoice: Invoice) => <div className="min-w-0"><Button type="button" variant="link" onClick={event => { event.stopPropagation(); onOpenInvoice(invoice.id); }} className="h-auto min-h-0 min-w-0 max-w-full justify-start whitespace-normal border-0 p-0 text-left font-mono text-sm leading-5"><FileText className="size-4 shrink-0"/><span className="[overflow-wrap:anywhere]">{formatInvoiceNumber(invoice.invoice_number)}</span></Button>{invoice.is_rectification && <p className="text-xs text-muted-foreground">{labels.rectification}</p>}</div>;
 const actions = (invoice: Invoice) => <span onClick={event => event.stopPropagation()}><ActionPopover align="end" options={[{ label: "Ver detalle", icon: Eye, onClick: () => onOpenInvoice(invoice.id) }, ...(canManage && invoice.status === "draft" ? [{ label: "Editar", icon: Edit3, onClick: () => onOpenInvoice(invoice.id, "edit"), variant: "edit" as const }] : [])]} /></span>;
 return <DataListTable items={invoices} getRowKey={invoice => invoice.id} persistenceKey={INVOICE_TABLE_KEY} customizable
 sortOptions={[
  { value: "date-desc", label: "Emisión: más recientes", compare: (a, b) => b.issue_date.localeCompare(a.issue_date) },
  { value: "due-asc", label: "Vencimiento: primero próximo", compare: (a, b) => (a.due_date || "9999").localeCompare(b.due_date || "9999") },
  { value: "balance-desc", label: "Saldo: mayor primero", compare: (a, b) => invoiceOutstandingCents(b) - invoiceOutstandingCents(a) },
  { value: "client-asc", label: "Cliente A–Z", compare: (a, b) => getClientName(a.client_id).localeCompare(getClientName(b.client_id)) },
 ]}
 columns={[{ key: "number", label: "Documento", hideable: false, className: "w-[14%] xl:w-[20%]" }, { key: "client", label: labels.client, className: "w-[15%] xl:w-[20%]" }, { key: "date", label: labels.issue_date, className: "w-[12%] xl:w-[14%]" }, { key: "total", label: labels.total, className: "w-[14%] xl:w-[10%] text-right" }, { key: "paid", label: "Cobrado", className: "w-[14%] xl:w-[10%] text-right" }, { key: "balance", label: "Saldo", className: "w-[14%] xl:w-[10%] text-right" }, { key: "status", label: labels.status, className: "w-[12%] xl:w-[10%]" }, { key: "actions", label: <span className="sr-only">{labels.actions}</span>, labelText: labels.actions, hideable: false, className: "w-[5%] xl:w-[6%] text-right" }]}
 header={{ title: "Facturas registradas", subtitle: `EUR · saldo a ${asOf}. Pulsa una fila para abrir el documento.`, countLabel: `${invoices.length} facturas` }}
 loading={loading} loadingLabel={loadingLabel} desktopFrom="lg" onRowClick={invoice => onOpenInvoice(invoice.id)} rowAriaLabel={invoice => `Abrir factura ${invoice.invoice_number} de ${getClientName(invoice.client_id)}`}
 empty={<div className="py-6 text-center"><FileText className="mx-auto size-8 text-muted-foreground"/><h3 className="mt-3 text-sm font-semibold">No hay facturas para esta selección</h3><p className="mt-1 text-xs text-muted-foreground">{emptyLabel}</p></div>}
 renderDesktopRow={invoice => [<span key="number">{identity(invoice)}</span>, <span key="client" className="text-sm font-medium">{getClientName(invoice.client_id)}</span>, <span key="date" className="text-xs"><span className="block">{formatDate(invoice.issue_date)}</span><span className={`mt-1 block ${isInvoiceOverdue(invoice, asOf) ? "text-orange-600 dark:text-orange-300" : "text-muted-foreground"}`}>{invoice.due_date ? `Vence ${formatDate(invoice.due_date)}` : "Sin vencimiento"}</span></span>, <span key="total" className="block whitespace-nowrap text-right text-sm tabular-nums">{formatCurrency(invoice.total_amount)}</span>, <span key="paid" className="block whitespace-nowrap text-right text-sm tabular-nums">{formatCurrency(invoice.collected_amount ?? 0)}</span>, <span key="balance" className="block whitespace-nowrap text-right text-sm font-semibold tabular-nums">{formatCurrency(invoiceOutstandingCents(invoice) / 100)}</span>, <span key="status">{status(invoice)}</span>, <span key="actions" className="flex justify-end">{actions(invoice)}</span>]}
 renderCompactRow={invoice => <div className="space-y-3"><div className="flex items-start justify-between gap-2">{identity(invoice)}{status(invoice)}</div><p className="text-sm font-medium">{getClientName(invoice.client_id)}</p><p className="text-xs text-muted-foreground">{formatDate(invoice.issue_date)} · {invoice.due_date ? `Vence ${formatDate(invoice.due_date)}` : "Sin vencimiento"}</p><div className="grid grid-cols-3 gap-2 border-t pt-2 text-xs"><span>Total<strong className="mt-1 block tabular-nums">{formatCurrency(invoice.total_amount)}</strong></span><span>Cobrado<strong className="mt-1 block tabular-nums">{formatCurrency(invoice.collected_amount ?? 0)}</strong></span><span>Saldo<strong className="mt-1 block tabular-nums">{formatCurrency(invoiceOutstandingCents(invoice) / 100)}</strong></span></div><div className="flex justify-end">{actions(invoice)}</div></div>} />;
}
