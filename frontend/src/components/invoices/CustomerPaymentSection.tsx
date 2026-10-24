"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CircleDollarSign, Loader2, Plus, RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { canOfferCustomerPayment, getCollectibleRemaining } from "@/components/invoices/invoice-payment-eligibility";
import { CustomerPaymentVoidDialog } from "@/components/invoices/CustomerPaymentVoidDialog";
import { DateTimePicker } from "@/components/ui/date-time-picker";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CustomerPaymentService, type CustomerPayment } from "@/services/customer-payment.service";
import type { Invoice, InvoicePaymentMethod } from "@/types/invoice";
import { formatCurrency, formatDate } from "@/lib/format";
import { toast } from "@/lib/toast";

const PAYMENT_METHODS: Array<{ value: InvoicePaymentMethod; label: string }> = [
    { value: "bank_transfer", label: "Transferencia" },
    { value: "direct_debit", label: "Domiciliación" },
    { value: "card", label: "Tarjeta" },
    { value: "cash", label: "Efectivo" },
    { value: "bizum", label: "Bizum" },
    { value: "other", label: "Otro" },
];

function currentLocalDateTime() {
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    return now.toISOString().slice(0, 16);
}

type CustomerPaymentSectionProps = {
    invoice: Invoice;
    canManage: boolean;
    onChanged: () => void;
};

export function CustomerPaymentSection({ invoice, canManage, onChanged }: CustomerPaymentSectionProps) {
    const [payments, setPayments] = useState<CustomerPayment[]>([]);
    const [loading, setLoading] = useState(true);
    const [open, setOpen] = useState(false);
    const [saving, setSaving] = useState(false);
    const [paymentToVoid, setPaymentToVoid] = useState<CustomerPayment | null>(null);
    const [voidingPaymentId, setVoidingPaymentId] = useState<number | null>(null);
    const [paymentDetails, setPaymentDetails] = useState({
        receivedAt: currentLocalDateTime(),
        amount: "",
        allocatedAmount: "",
        paymentMethod: invoice.payment_method || "bank_transfer" as InvoicePaymentMethod,
        reference: "",
    });
    const { receivedAt, amount, allocatedAmount, paymentMethod, reference } = paymentDetails;
    const updatePaymentDetails = (patch: Partial<typeof paymentDetails>) => setPaymentDetails((current) => ({ ...current, ...patch }));
    const setReceivedAt = (receivedAt: string) => updatePaymentDetails({ receivedAt });
    const setAmount = (amount: string) => updatePaymentDetails({ amount });
    const setAllocatedAmount = (allocatedAmount: string) => updatePaymentDetails({ allocatedAmount });
    const setPaymentMethod = (paymentMethod: InvoicePaymentMethod) => updatePaymentDetails({ paymentMethod });
    const setReference = (reference: string) => updatePaymentDetails({ reference });

    const loadPayments = useCallback(async () => {
        try {
            setLoading(true);
            setPayments(await CustomerPaymentService.getPayments(invoice.client_id));
        } catch (error) {
            console.error("Unable to load customer payments", error);
            toast.error(error instanceof Error ? error.message : "No se pudieron cargar los cobros");
        } finally {
            setLoading(false);
        }
    }, [invoice.client_id]);

    useEffect(() => {
        const timer = window.setTimeout(() => {
            void loadPayments();
        }, 0);
        return () => window.clearTimeout(timer);
    }, [loadPayments]);

    const invoicePayments = useMemo(
        () => payments.filter((payment) => payment.allocations.some((allocation) => allocation.invoice_id === invoice.id)),
        [invoice.id, payments],
    );
    const allocated = useMemo(
        () => invoicePayments
            .filter((payment) => payment.status === "received")
            .reduce((total, payment) => total + payment.allocations
                .filter((allocation) => allocation.invoice_id === invoice.id)
                .reduce((allocationTotal, allocation) => allocationTotal + Number(allocation.amount), 0), 0),
        [invoice.id, invoicePayments],
    );
    const remaining = getCollectibleRemaining(invoice, allocated);

    const openForm = () => {
        const remainder = remaining.toFixed(2);
        setReceivedAt(currentLocalDateTime());
        setAmount(remainder);
        setAllocatedAmount(remainder);
        setPaymentMethod(invoice.payment_method || "bank_transfer");
        setReference("");
        setOpen(true);
    };

    const submit = async () => {
        const receiptAmount = Number(amount);
        const allocation = Number(allocatedAmount);
        if (!Number.isFinite(receiptAmount) || receiptAmount <= 0 || !Number.isFinite(allocation) || allocation <= 0) {
            toast.error("Indica importes positivos para el cobro y el reparto.");
            return;
        }
        if (allocation > receiptAmount || allocation > remaining + 0.0001) {
            toast.error("El reparto no puede superar el cobro ni el saldo pendiente de esta factura.");
            return;
        }
        try {
            setSaving(true);
            await CustomerPaymentService.createPayment({
                client_id: invoice.client_id,
                received_at: new Date(receivedAt).toISOString(),
                amount: receiptAmount.toFixed(2),
                payment_method: paymentMethod,
                reference: reference.trim() || null,
                allocations: [{ invoice_id: invoice.id, amount: allocation.toFixed(2) }],
            });
            toast.success("Cobro registrado.");
            setOpen(false);
            await loadPayments();
            onChanged();
        } catch (error) {
            console.error("Unable to create customer payment", error);
            toast.error(error instanceof Error ? error.message : "No se pudo registrar el cobro");
        } finally {
            setSaving(false);
        }
    };

    const voidPayment = async (payment: CustomerPayment, reason: string) => {
        setVoidingPaymentId(payment.id);
        try {
            await CustomerPaymentService.voidPayment(payment.id, reason);
            toast.success("Cobro anulado.");
            await loadPayments();
            onChanged();
            return true;
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "No se pudo anular el cobro");
            return false;
        } finally {
            setVoidingPaymentId(null);
        }
    };

    return <section className="mt-4 rounded-2xl border border-[var(--border-soft)] bg-[var(--bg-secondary)]/35 p-4 print:hidden">
        <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex items-start gap-3"><span className="rounded-xl bg-[var(--btn-secondary-bg)] p-2 text-[var(--btn-secondary-text)]"><CircleDollarSign className="size-4" /></span><div><h3 className="text-sm font-semibold text-[var(--text-main)]">Cobros</h3><p className="mt-0.5 text-xs text-[var(--text-muted)]">Asignado: {formatCurrency(allocated)} · Pendiente: {formatCurrency(remaining)}</p></div></div>
            {canOfferCustomerPayment(invoice, canManage, remaining) ? <Button type="button" onClick={openForm} className="h-9 rounded-xl text-xs"><Plus className="size-3.5" />Registrar cobro</Button> : null}
        </div>
        {loading ? <div className="flex items-center gap-2 py-4 text-xs text-[var(--text-muted)]"><Loader2 className="size-4 animate-spin" />Cargando cobros…</div> : invoicePayments.length === 0 ? <p className="py-4 text-xs text-[var(--text-muted)]">Todavía no hay cobros asignados a esta factura.</p> : <div className="mt-4 space-y-2">{invoicePayments.map((payment) => {
            const applied = payment.allocations.filter((allocation) => allocation.invoice_id === invoice.id).reduce((total, allocation) => total + Number(allocation.amount), 0);
            return <div key={payment.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[var(--border-soft)] bg-[var(--bg-primary)] px-3 py-2.5 text-xs"><div><p className="font-semibold text-[var(--text-main)]">{formatCurrency(applied)} · {formatDate(payment.received_at)}</p><p className="mt-0.5 text-[var(--text-muted)]">{payment.reference || "Sin referencia"}{payment.status === "voided" ? " · Anulado" : ""}</p></div><div className="flex items-center gap-2"><span className={payment.status === "received" ? "rounded-full bg-[var(--btn-secondary-bg)] px-2 py-1 text-[10px] font-semibold uppercase text-[var(--btn-secondary-text)]" : "rounded-full bg-[var(--alert-warning-bg)] px-2 py-1 text-[10px] font-semibold uppercase text-[var(--alert-warning-text)]"}>{payment.status === "received" ? "Recibido" : "Anulado"}</span>{canManage && payment.status === "received" ? <Button type="button" size="sm" variant="ghost" className="h-7 px-2 text-[11px] text-destructive hover:text-destructive" disabled={voidingPaymentId === payment.id} onClick={() => setPaymentToVoid(payment)}>{voidingPaymentId === payment.id ? <Loader2 className="size-3.5 animate-spin" /> : <RotateCcw className="size-3.5" />}Anular</Button> : null}</div></div>;
        })}</div>}
        <Dialog open={open} onOpenChange={setOpen}><DialogContent compact className="max-w-md"><DialogHeader><DialogTitle>Registrar cobro</DialogTitle><DialogDescription>El cobro se asignará a esta factura. Si el importe recibido es mayor, el resto quedará sin aplicar para su conciliación posterior.</DialogDescription></DialogHeader><div className="grid gap-4 py-2"><div className="grid gap-2"><Label htmlFor="payment-received-at">Fecha y hora de cobro</Label><DateTimePicker id="payment-received-at" value={receivedAt} onValueChange={(nextReceivedAt) => setReceivedAt(nextReceivedAt ?? "")} /></div><div className="grid gap-2 sm:grid-cols-2"><div className="grid gap-2"><Label htmlFor="payment-amount">Importe recibido</Label><Input id="payment-amount" type="number" min="0.01" step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} /></div><div className="grid gap-2"><Label htmlFor="payment-allocation">Aplicar a factura</Label><Input id="payment-allocation" type="number" min="0.01" max={remaining.toFixed(2)} step="0.01" value={allocatedAmount} onChange={(event) => setAllocatedAmount(event.target.value)} /></div></div><div className="grid gap-2"><Label>Forma de pago</Label><Select value={paymentMethod} onValueChange={(value) => setPaymentMethod(value as InvoicePaymentMethod)}><SelectTrigger aria-label="Forma de pago"><SelectValue /></SelectTrigger><SelectContent>{PAYMENT_METHODS.map((method) => <SelectItem key={method.value} value={method.value}>{method.label}</SelectItem>)}</SelectContent></Select></div><div className="grid gap-2"><Label htmlFor="payment-reference">Referencia</Label><Input id="payment-reference" maxLength={160} value={reference} onChange={(event) => setReference(event.target.value)} placeholder="Transferencia, recibo, operación…" /></div></div><DialogFooter><Button type="button" variant="cancel" onClick={() => setOpen(false)} disabled={saving}>Cancelar</Button><Button type="button" onClick={() => void submit()} disabled={saving}>{saving ? <Loader2 className="size-4 animate-spin" /> : null}Guardar cobro</Button></DialogFooter></DialogContent></Dialog>
        <CustomerPaymentVoidDialog payment={paymentToVoid} isSubmitting={voidingPaymentId !== null} onOpenChange={(nextOpen) => !nextOpen && setPaymentToVoid(null)} onConfirm={voidPayment} />
    </section>;
}
