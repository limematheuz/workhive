"use client";
import { snapshotLineRows } from "@/lib/snapshot-line-rows";

import { RecordHistoryPanel } from "@/components/history/RecordHistoryPanel";
import { useState } from "react";
import Link from "next/link";
import { ArrowUpRight, Pencil, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { CustomerPaymentVoidDialog } from "@/components/invoices/CustomerPaymentVoidDialog";
import { CustomerPaymentService, type CustomerPayment } from "@/services/customer-payment.service";
import { currencyKinds, currencyMoney, currencyStatuses } from "@/lib/transaction-currency";
import type { CurrencyRecord } from "@/types/transaction-currency";

export function CurrencyRecordDetail({ record, canManage, edit, refresh }: { record: CurrencyRecord; canManage: boolean; edit: () => void; refresh: () => void }) {
    const [payment, setPayment] = useState<CustomerPayment | null>(null), [busy, setBusy] = useState(false);
    const snapshot = record.currency_snapshot;
    const difference = Number(snapshot.realized_exchange_difference_eur ?? 0);
    const link = record.kind === "invoices" ? `/dashboard/invoices/${record.id}` : record.kind === "expenses" ? "/dashboard/expenses" : record.kind === "sales" ? "/dashboard/invoice-summary" : null;
    const inspectPayment = async () => {
        setBusy(true);
        try { const payments = await CustomerPaymentService.getPayments(Number(snapshot.original_document.client_id)); const found = payments.find(item => item.id === record.id); if (!found) throw new Error("El cobro ya no está disponible. Actualiza la lista."); setPayment(found); }
        catch (cause) { toast.error(cause instanceof Error ? cause.message : "No se pudo abrir el cobro."); }
        finally { setBusy(false); }
    };
    return <aside className="min-w-0 space-y-4 rounded-2xl border bg-card p-4"><header><p className="text-xs text-muted-foreground">{currencyKinds[record.kind]} · {currencyStatuses[record.status] ?? record.status}</p><h2 className="mt-1 break-words font-semibold">{record.label}</h2></header><div className="rounded-xl bg-muted/50 p-4"><p className="text-xs text-muted-foreground">Importe original</p><p className="mt-1 break-words text-2xl font-semibold tabular-nums">{currencyMoney(snapshot.original_amounts.total_amount, snapshot.currency)}</p><p className="mt-2 text-sm text-muted-foreground">Equivalencia contable: <strong className="text-foreground">{currencyMoney(record.amount_eur)}</strong></p></div>
        <dl className="space-y-2 text-sm"><div className="flex justify-between gap-3"><dt className="text-muted-foreground">Cambio verificado</dt><dd className="text-right">1 {snapshot.currency} = {snapshot.eur_rate} EUR</dd></div><div className="flex justify-between gap-3"><dt className="text-muted-foreground">Fecha del cambio</dt><dd>{snapshot.rate_date}</dd></div>{snapshot.original_amounts.base_amount != null && <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Base original</dt><dd>{currencyMoney(snapshot.original_amounts.base_amount, snapshot.currency)}</dd></div>}{snapshot.original_amounts.tax_amount != null && <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Impuestos originales</dt><dd>{currencyMoney(snapshot.original_amounts.tax_amount, snapshot.currency)}</dd></div>}{Number(snapshot.rounding_difference_eur) !== 0 && <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Diferencia por redondeo</dt><dd>{currencyMoney(snapshot.rounding_difference_eur)}</dd></div>}{record.kind === "payments" && <div className="flex justify-between gap-3 border-t pt-3"><dt className="text-muted-foreground">{difference < 0 ? "Pérdida por cambio" : difference > 0 ? "Ganancia por cambio" : "Diferencia de cambio"}</dt><dd>{currencyMoney(Math.abs(difference))}</dd></div>}</dl>
        {Boolean(snapshot.original_lines?.length) && <div className="space-y-3 border-t pt-4"><h3 className="text-xs font-semibold uppercase text-muted-foreground">Conceptos originales</h3>{snapshotLineRows(snapshot.original_lines ?? []).map(({line, key}) => <div key={key} className="flex justify-between gap-3 text-sm"><div className="min-w-0"><p className="break-words font-medium">{line.description}</p><p className="text-xs text-muted-foreground">{line.quantity} × {currencyMoney(line.unit_price, snapshot.currency, true)}</p></div><span className="shrink-0 tabular-nums">{currencyMoney(line.subtotal, snapshot.currency)}</span></div>)}</div>}
        <div className="flex flex-wrap gap-2 border-t pt-4">{canManage && record.editable && <Button variant="outline" size="sm" onClick={edit}><Pencil className="size-4" />Editar en moneda original</Button>}{link && <Button variant="outline" size="sm" asChild><Link href={link}>Abrir ficha<ArrowUpRight className="size-4" /></Link></Button>}{canManage && record.kind === "payments" && record.status === "received" && <Button variant="outline" size="sm" disabled={busy} onClick={() => void inspectPayment()}><RotateCcw className="size-4" />{busy ? "Cargando…" : "Anular cobro"}</Button>}</div>
        {!record.editable && <p className="text-xs leading-5 text-muted-foreground">{record.kind === "invoices" ? "Una factura emitida se corrige con una rectificativa desde su ficha." : record.kind === "payments" ? "Un cobro se conserva en el historial. Para corregirlo, anúlalo con un motivo y registra el movimiento correcto." : "Esta operación ya no admite cambios."}</p>}
        {(record.kind==="invoices"||record.kind==="expenses")&&<RecordHistoryPanel entityType={record.kind==="invoices"?"invoice":"expense"} entityId={record.id}/>}
        <CustomerPaymentVoidDialog payment={payment} isSubmitting={busy} onOpenChange={open => { if (!open && !busy) setPayment(null); }} onConfirm={async (selected, reason) => { setBusy(true); try { await CustomerPaymentService.voidPayment(selected.id, reason); setPayment(null); refresh(); toast.success("Cobro anulado. Se conserva su historial."); return true; } catch (cause) { toast.error(cause instanceof Error ? cause.message : "No se pudo anular el cobro."); return false; } finally { setBusy(false); } }} />
    </aside>;
}
