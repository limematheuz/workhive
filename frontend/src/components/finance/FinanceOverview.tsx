"use client";

import Link from "next/link";
import { Banknote, Clock3, Download, FileText, OctagonAlert } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { DataListTable } from "@/components/ui/data-list-table";
import { SummaryMetricGrid } from "@/components/ui/summary-metric-card";
import { FinanceMetricButton } from "./FinanceMetricButton";
import { FinanceLoadError } from "./FinanceLoadError";
import { useFinanceOverview } from "./use-finance-overview";
import { useViewState } from "@/hooks/useViewState";
import { downloadBlob } from "@/lib/download-blob";
import { formatCurrency, formatDate } from "@/lib/format";
import { financeLocalDay, invoiceOutstandingCents, isInvoiceOverdue } from "@/lib/finance-priorities";
import { financeCents, inFinanceMonth, invoiceAgingBucket, paymentTotalCents, selectPeriodPayments, type AgingBucket } from "@/lib/finance-workspace";
import type { SalesLedgerEntry } from "@/services/sales-ledger.service";

type Scope = "billed" | "received" | "pending" | "overdue";
type SourceRow = { key: string; reference: string; client: string; date: string; total: number; paid: number | null; balance: number | null; href?: string };
const scopes: Record<Scope, string> = { billed: "Facturado por emisión", received: "Cobros por recepción", pending: "Saldo pendiente actual", overdue: "Saldo vencido actual" };
const agingLabels: Record<AgingBucket, string> = { current: "No vencido", "1-30": "1–30 días", "31-60": "31–60 días", "61-90": "61–90 días", "90+": "Más de 90 días", undated: "Sin vencimiento" };

function csvCell(value: unknown) {
    const raw = String(value ?? "");
    return `"${(/^[=+@-]/.test(raw) ? "'" : "") + raw.replace(/"/g, '""')}"`;
}

export function FinanceOverview({ entries, ledgerAvailable }: { entries: SalesLedgerEntry[]; ledgerAvailable: boolean }) {
    const { invoices, payments, loading, errors, reload } = useFinanceOverview();
    const [month, setMonth] = useViewState("finance.summary.month", () => financeLocalDay(new Date()).slice(0, 7));
    const [scope, setScope] = useViewState<Scope>("finance.summary.scope", "billed");
    const [aging, setAging] = useState<AgingBucket | null>(null);
    const asOf = financeLocalDay(new Date());
    const monthlyEntries = entries.filter((entry) => inFinanceMonth(entry.entry_date, month));
    const periodPayments = payments === null ? null : selectPeriodPayments(payments, month);
    const pending = invoices?.filter((invoice) => invoiceOutstandingCents(invoice) > 0) ?? null;
    const overdue = pending?.filter((invoice) => isInvoiceOverdue(invoice, asOf)) ?? null;
    const total = ledgerAvailable && monthlyEntries.every((entry) => financeCents(entry.total_amount) !== null) ? monthlyEntries.reduce((sum, entry) => sum + financeCents(entry.total_amount)!, 0) : null;
    const received = periodPayments === null ? null : paymentTotalCents(periodPayments);
    const balance = pending === null ? null : pending.reduce((sum, invoice) => sum + invoiceOutstandingCents(invoice), 0);
    const overdueBalance = overdue === null ? null : overdue.reduce((sum, invoice) => sum + invoiceOutstandingCents(invoice), 0);
    const value = (cents: number | null) => cents === null ? "No disponible" : formatCurrency(cents / 100);
    const chooseScope = (next: Scope) => { setScope(next); setAging(null); };
    const ledgerByInvoice = new Map(entries.filter((entry) => entry.source_type === "invoice").map((entry) => [entry.source_id, entry]));
    let rows: SourceRow[];
    if (scope === "received") rows = (periodPayments ?? []).map((payment) => ({ key: `payment-${payment.id}`, reference: payment.reference || `Cobro #${payment.id}`, client: `Cliente #${payment.client_id}`, date: payment.received_at, total: Number(payment.amount), paid: Number(payment.amount), balance: null, href: payment.allocations.length === 1 ? `/dashboard/invoices?invoice=${payment.allocations[0].invoice_id}` : undefined }));
    else if (scope === "pending" || scope === "overdue") rows = (scope === "pending" ? pending ?? [] : overdue ?? []).filter((invoice) => !aging || invoiceAgingBucket(invoice, asOf) === aging).map((invoice) => ({ key: `invoice-${invoice.id}`, reference: invoice.invoice_number, client: ledgerByInvoice.get(invoice.id)?.client_name ?? `Cliente #${invoice.client_id}`, date: invoice.due_date ?? "", total: invoice.total_amount, paid: invoice.collected_amount ?? 0, balance: invoiceOutstandingCents(invoice) / 100, href: `/dashboard/invoices?invoice=${invoice.id}` }));
    else rows = monthlyEntries.map((entry) => ({ key: `${entry.source_type}-${entry.source_id}`, reference: entry.document_number, client: entry.client_name, date: entry.entry_date, total: entry.total_amount, paid: entry.source_type === "invoice" ? entry.collected_amount ?? null : entry.payment_status === "paid" ? entry.total_amount : 0, balance: entry.source_type === "invoice" ? null : entry.payment_status === "pending" ? entry.total_amount : 0, href: entry.source_type === "invoice" ? `/dashboard/invoices?invoice=${entry.source_id}` : undefined }));
    const available = scope === "billed" ? ledgerAvailable : scope === "received" ? payments !== null : invoices !== null;
    const exportRows = () => downloadBlob(new Blob(["\ufeff" + ["Documento;Cliente;Fecha;Total EUR;Cobrado EUR;Saldo EUR", ...rows.map((row) => [row.reference, row.client, row.date.slice(0, 10), row.total.toFixed(2), row.paid?.toFixed(2), row.balance?.toFixed(2)].map(csvCell).join(";"))].join("\n")], { type: "text/csv;charset=utf-8" }), `resumen-${scope}-${month}-saldo-${asOf}.csv`);
    const historical = entries.filter((entry) => entry.source_type === "manual");
    const monthAmounts = Array.from({ length: 12 }, (_, index) => entries.filter((entry) => inFinanceMonth(entry.entry_date, `${month.slice(0, 4)}-${String(index + 1).padStart(2, "0")}`)).reduce((sum, entry) => sum + entry.total_amount, 0));
    const maxMonth = Math.max(1, ...monthAmounts.map(Math.abs));
    const monthDate = new Date(`${month}-01T12:00:00`);
    const monthLabel = Number.isNaN(monthDate.getTime()) ? month : new Intl.DateTimeFormat("es-ES", { month: "long", year: "numeric" }).format(monthDate);
    const hasYearActivity = entries.some((entry) => entry.entry_date.slice(0, 4) === month.slice(0, 4));

    return <div className="space-y-4">
        <div className="billing-surface flex flex-wrap items-center justify-between gap-3 rounded-xl p-4">
            <div className="grid w-full gap-2 sm:w-auto sm:min-w-80"><label htmlFor="finance-summary-month" className="text-sm font-medium">Actividad de {monthLabel}</label><DatePicker id="finance-summary-month" aria-label="Mes del resumen" value={`${month}-01`} onValueChange={(date) => date && setMonth(date.slice(0, 7))} /></div>
            <p className="text-xs text-muted-foreground">EUR · Saldos a {formatDate(asOf)} · Actualización al cargar</p>
        </div>
        {errors.length > 0 && <FinanceLoadError message={`No se han podido consultar: ${errors.join(", ")}. Los importes afectados no se muestran como cero.`} onRetry={() => void reload()} />}
        <SummaryMetricGrid desktopColumns={4} aria-label="Resumen financiero reconciliable">
            <FinanceMetricButton label="Facturado" value={value(total)} description={`${monthlyEntries.length} documentos · emisión ${month}`} icon={FileText} active={scope === "billed"} onClick={() => chooseScope("billed")} />
            <FinanceMetricButton label="Cobrado" value={value(received)} description={`${periodPayments?.length ?? "—"} cobros registrados · recepción ${month}`} icon={Banknote} active={scope === "received"} onClick={() => chooseScope("received")} />
            <FinanceMetricButton label="Pendiente" value={value(balance)} description={`${pending?.length ?? "—"} facturas · saldo a ${asOf}`} icon={Clock3} active={scope === "pending"} onClick={() => chooseScope("pending")} />
            <FinanceMetricButton label="Vencido" value={value(overdueBalance)} description={`${overdue?.length ?? "—"} facturas · incluido en pendiente`} icon={OctagonAlert} active={scope === "overdue"} attention={(overdueBalance ?? 0) > 0} onClick={() => chooseScope("overdue")} />
        </SummaryMetricGrid>
        {historical.length > 0 && <p role="status" className="rounded-xl border border-orange-400/40 bg-orange-400/5 p-3 text-xs leading-5">Datos parciales de cobros y deuda: los {historical.length} registros históricos del libro no tienen fecha de cobro ni vencimiento. Figuran en facturado y en el libro; los saldos y la antigüedad de este resumen corresponden a facturas de WorkHive.</p>}
        <div className="grid gap-4 xl:grid-cols-2">
            <section className="billing-surface rounded-xl p-4"><h2 className="text-base font-semibold">Evolución de facturación · {month.slice(0, 4)}</h2><p className="mt-1 text-xs text-muted-foreground">Importe con impuestos por emisión. Pulsa un mes para ver su origen.</p>{ledgerAvailable && hasYearActivity ? <><p className="mt-4 flex flex-wrap items-baseline justify-between gap-2 text-sm"><span className="capitalize text-muted-foreground">{monthLabel}</span><strong className="text-lg font-semibold tabular-nums">{value(total)}</strong></p><div className="mt-3 grid grid-cols-6 gap-2 sm:grid-cols-12">{Array.from({ length: 12 }, (_, index) => {
                const key = `${month.slice(0, 4)}-${String(index + 1).padStart(2, "0")}`;
                const amount = monthAmounts[index];
                const shortMonth = new Intl.DateTimeFormat("es-ES", { month: "short" }).format(new Date(2000, index, 1)).replace(".", "");
                return <Button type="button" variant="ghost" key={key} onClick={() => { setMonth(key); chooseScope("billed"); }} aria-label={`${key}: ${formatCurrency(amount)}, ver documentos`} aria-pressed={key === month} title={`${shortMonth}: ${formatCurrency(amount)}`} className={`h-24 min-w-0 flex-col justify-end gap-2 rounded-lg p-1 sm:h-28 ${key === month ? "bg-accent/10 ring-1 ring-accent" : ""}`}><span aria-hidden="true" className="w-5 rounded-t bg-accent/70" style={{ height: `${Math.min(68, Math.abs(amount) / maxMonth * 68)}px` }} /><span className="text-xs capitalize">{shortMonth}</span></Button>;
            })}</div></> : <p role="status" className="mt-4 rounded-lg bg-muted/40 p-4 text-sm text-muted-foreground">{ledgerAvailable ? `No hay documentos de facturación registrados en ${month.slice(0, 4)}. La evolución aparecerá cuando haya actividad.` : "Evolución no disponible. Consulta de nuevo el libro de ventas."}</p>}</section>
            <section className="billing-surface rounded-xl p-4"><h2 className="text-base font-semibold">Antigüedad del saldo · {formatDate(asOf)}</h2><p className="mt-1 text-xs text-muted-foreground">Sólo saldo pendiente. Sin fecha de vencimiento se muestra aparte.</p><div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">{(Object.entries(agingLabels) as Array<[AgingBucket, string]>).map(([key, label]) => {
                const amount = pending?.filter((invoice) => invoiceAgingBucket(invoice, asOf) === key).reduce((sum, invoice) => sum + invoiceOutstandingCents(invoice), 0) ?? null;
                return <Button key={key} type="button" variant="outline" className="h-auto flex-col items-start gap-1 p-3" onClick={() => { setScope("pending"); setAging(key); }}><span className="text-xs text-muted-foreground">{label}</span><span className="text-sm font-semibold tabular-nums">{value(amount)}</span></Button>;
            })}</div></section>
        </div>
        <DataListTable items={available ? rows : []} getRowKey={(row) => row.key}
            columns={[{ key: "reference", label: "Documento / cobro" }, { key: "client", label: "Cliente" }, { key: "date", label: scope === "received" ? "Fecha de cobro" : scope === "billed" ? "Emisión" : "Vencimiento" }, { key: "total", label: "Total EUR", className: "text-right" }, { key: "paid", label: "Cobrado EUR", className: "text-right" }, { key: "balance", label: "Saldo EUR", className: "text-right" }]}
            header={{ title: `${scopes[scope]}${aging ? ` · ${agingLabels[aging]}` : ""}`, countLabel: `${rows.length} registros` }} loading={loading} loadingLabel="Consultando todos los registros…"
            toolbar={<div className="flex flex-wrap items-center gap-2"><span className="flex-1 text-xs text-muted-foreground">{scope === "pending" || scope === "overdue" ? `Todas las emisiones · saldo a ${asOf}` : `Periodo ${month}`} · {available ? "El CSV contiene estos mismos registros" : "Información no disponible"}</span>{aging && <Button size="sm" variant="outline" onClick={() => setAging(null)}>Quitar antigüedad</Button>}<Button size="sm" variant="outline" onClick={exportRows} disabled={!available || rows.length === 0}><Download />Exportar selección</Button></div>}
            empty={<p className="text-sm text-muted-foreground">{available ? "No hay registros para esta selección." : "No se puede consultar este origen. Vuelve a intentarlo."}</p>}
            renderDesktopRow={(row) => [<span key="ref">{row.href ? <Link className="font-medium text-accent underline-offset-4 hover:underline" href={row.href}>{row.reference}</Link> : row.reference}</span>, <span key="client">{row.client}</span>, <span key="date">{row.date ? formatDate(row.date) : "Sin vencimiento"}</span>, <span key="total" className="block text-right tabular-nums">{formatCurrency(row.total)}</span>, <span key="paid" className="block text-right tabular-nums">{row.paid === null ? "—" : formatCurrency(row.paid)}</span>, <span key="balance" className="block text-right tabular-nums">{row.balance === null ? "—" : formatCurrency(row.balance)}</span>]}
            renderCompactRow={(row) => <div className="space-y-2"><p className="font-medium">{row.href ? <Link className="text-accent" href={row.href}>{row.reference}</Link> : row.reference}</p><p className="text-xs text-muted-foreground">{row.client} · {row.date ? formatDate(row.date) : "Sin vencimiento"}</p><p className="text-sm font-semibold tabular-nums">{formatCurrency(scope === "pending" || scope === "overdue" ? row.balance ?? 0 : row.total)}</p></div>} />
    </div>;
}
