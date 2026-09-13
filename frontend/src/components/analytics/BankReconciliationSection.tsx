"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Landmark, Link2, Loader2, Plus, RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatCurrency, formatDate } from "@/lib/format";
import { toast } from "@/lib/toast";
import { CustomerPaymentService, type CustomerPayment } from "@/services/customer-payment.service";
import { BankReconciliationService, type BankStatementEntry } from "@/services/bank-reconciliation.service";

type Copy = Record<string, string>;

function currentLocalDateTime() {
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    return now.toISOString().slice(0, 16);
}

function sameAmount(left: number, right: number) {
    return Math.abs(left - right) < 0.005;
}

export function BankReconciliationSection({ copy, canManage }: { copy: Copy; canManage: boolean }) {
    const [entries, setEntries] = useState<BankStatementEntry[]>([]);
    const [payments, setPayments] = useState<CustomerPayment[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [createOpen, setCreateOpen] = useState(false);
    const [matchingEntry, setMatchingEntry] = useState<BankStatementEntry | null>(null);
    const [unmatchingEntry, setUnmatchingEntry] = useState<BankStatementEntry | null>(null);
    const [reconciliationForm, setReconciliationForm] = useState({
        bookedAt: currentLocalDateTime(),
        amount: "",
        reference: "",
        externalId: "",
        counterparty: "",
        paymentId: "",
        unmatchReason: "",
    });
    const { bookedAt, amount, reference, externalId, counterparty, paymentId, unmatchReason } = reconciliationForm;
    const updateReconciliationForm = (patch: Partial<typeof reconciliationForm>) => setReconciliationForm((current) => ({ ...current, ...patch }));
    const setBookedAt = (bookedAt: string) => updateReconciliationForm({ bookedAt });
    const setAmount = (amount: string) => updateReconciliationForm({ amount });
    const setReference = (reference: string) => updateReconciliationForm({ reference });
    const setExternalId = (externalId: string) => updateReconciliationForm({ externalId });
    const setCounterparty = (counterparty: string) => updateReconciliationForm({ counterparty });
    const setPaymentId = (paymentId: string) => updateReconciliationForm({ paymentId });
    const setUnmatchReason = (unmatchReason: string) => updateReconciliationForm({ unmatchReason });

    const load = useCallback(async () => {
        try {
            setLoading(true);
            const [nextEntries, nextPayments] = await Promise.all([
                BankReconciliationService.getEntries(),
                CustomerPaymentService.getPayments(),
            ]);
            setEntries(nextEntries);
            setPayments(nextPayments);
        } catch (error) {
            console.error("Unable to load bank reconciliation", error);
            toast.error(error instanceof Error ? error.message : copy.reconciliation_error_load);
        } finally {
            setLoading(false);
        }
    }, [copy.reconciliation_error_load]);

    useEffect(() => {
        const timer = window.setTimeout(() => void load(), 0);
        return () => window.clearTimeout(timer);
    }, [load]);

    const matchedPaymentIds = useMemo(
        () => new Set(entries.flatMap((entry) => entry.current_reconciliation ? [entry.current_reconciliation.customer_payment_id] : [])),
        [entries],
    );
    const matchablePayments = useMemo(
        () => matchingEntry
            ? payments.filter((payment) => payment.status === "received" && !matchedPaymentIds.has(payment.id) && sameAmount(Number(payment.amount), Number(matchingEntry.amount)))
            : [],
        [matchedPaymentIds, matchingEntry, payments],
    );

    const openCreate = () => {
        setBookedAt(currentLocalDateTime());
        setAmount("");
        setReference("");
        setExternalId("");
        setCounterparty("");
        setCreateOpen(true);
    };

    const createEntry = async () => {
        const numericAmount = Number(amount);
        if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
            toast.error(copy.reconciliation_amount_required);
            return;
        }
        try {
            setSaving(true);
            await BankReconciliationService.createEntry({
                booked_at: new Date(bookedAt).toISOString(),
                amount: numericAmount.toFixed(2),
                currency: "EUR",
                reference: reference.trim() || null,
                external_id: externalId.trim() || null,
                counterparty: counterparty.trim() || null,
            });
            toast.success(copy.reconciliation_entry_saved);
            setCreateOpen(false);
            await load();
        } catch (error) {
            console.error("Unable to create bank entry", error);
            toast.error(error instanceof Error ? error.message : copy.reconciliation_error_save);
        } finally {
            setSaving(false);
        }
    };

    const openMatch = (entry: BankStatementEntry) => {
        setPaymentId("");
        setMatchingEntry(entry);
    };

    const match = async () => {
        if (!matchingEntry || !paymentId) return;
        try {
            setSaving(true);
            await BankReconciliationService.matchEntry(matchingEntry.id, Number(paymentId));
            toast.success(copy.reconciliation_match_saved);
            setMatchingEntry(null);
            await load();
        } catch (error) {
            console.error("Unable to match bank entry", error);
            toast.error(error instanceof Error ? error.message : copy.reconciliation_error_save);
        } finally {
            setSaving(false);
        }
    };

    const unmatch = async () => {
        if (!unmatchingEntry || !unmatchReason.trim()) {
            toast.error(copy.reconciliation_reason_required);
            return;
        }
        try {
            setSaving(true);
            await BankReconciliationService.unmatchEntry(unmatchingEntry.id, unmatchReason.trim());
            toast.success(copy.reconciliation_unmatch_saved);
            setUnmatchingEntry(null);
            await load();
        } catch (error) {
            console.error("Unable to unmatch bank entry", error);
            toast.error(error instanceof Error ? error.message : copy.reconciliation_error_save);
        } finally {
            setSaving(false);
        }
    };

    const matchedCount = entries.filter((entry) => entry.status === "matched").length;
    const unmatchedCount = entries.length - matchedCount;

    return <section className="billing-surface rounded-[22px] p-4 sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-start gap-3"><span className="rounded-xl bg-[var(--btn-secondary-bg)] p-2 text-[var(--btn-secondary-text)]"><Landmark className="size-4" /></span><div><h2 className="text-base font-semibold text-[var(--text-main)]">{copy.reconciliation_title}</h2><p className="mt-0.5 max-w-2xl text-xs leading-5 text-[var(--text-muted)]">{copy.reconciliation_subtitle}</p></div></div>
            {canManage ? <Button type="button" onClick={openCreate} className="h-9 rounded-xl text-xs"><Plus className="size-3.5" />{copy.reconciliation_add_entry}</Button> : null}
        </div>
        <div className="mt-4 grid gap-2 sm:grid-cols-2"><div className="rounded-xl bg-[var(--bg-tertiary)] px-3 py-2.5"><p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--text-muted)]">{copy.reconciliation_unmatched}</p><p className="mt-1 text-lg font-semibold text-[var(--text-main)]">{unmatchedCount}</p></div><div className="rounded-xl bg-[var(--bg-tertiary)] px-3 py-2.5"><p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--text-muted)]">{copy.reconciliation_matched}</p><p className="mt-1 text-lg font-semibold text-[var(--text-main)]">{matchedCount}</p></div></div>
        {loading ? <div className="flex items-center gap-2 py-8 text-sm text-[var(--text-muted)]"><Loader2 className="size-4 animate-spin" />{copy.reconciliation_loading}</div> : entries.length === 0 ? <p className="py-8 text-sm text-[var(--text-muted)]">{copy.reconciliation_empty}</p> : <div className="mt-4 space-y-2">{entries.map((entry) => {
            const reconciliation = entry.current_reconciliation;
            return <article key={entry.id} className="flex flex-col gap-3 rounded-2xl border border-[var(--border-soft)] bg-[var(--bg-primary)] p-3 sm:flex-row sm:items-center sm:justify-between"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><p className="font-mono text-sm font-semibold text-[var(--text-main)]">{formatCurrency(Number(entry.amount))}</p><span className={entry.status === "matched" ? "rounded-full bg-[var(--btn-secondary-bg)] px-2 py-0.5 text-[10px] font-semibold uppercase text-[var(--btn-secondary-text)]" : "rounded-full bg-[var(--alert-warning-bg)] px-2 py-0.5 text-[10px] font-semibold uppercase text-[var(--alert-warning-text)]"}>{entry.status === "matched" ? copy.reconciliation_matched : copy.reconciliation_unmatched}</span></div><p className="mt-1 truncate text-xs text-[var(--text-muted)]">{formatDate(entry.booked_at)} · {entry.counterparty || copy.reconciliation_unknown_counterparty} · {entry.reference || entry.external_id || copy.reconciliation_no_reference}</p>{reconciliation ? <p className="mt-1 text-xs text-[var(--text-muted)]">{copy.reconciliation_receipt}: {formatCurrency(Number(reconciliation.payment.amount))} · {reconciliation.payment.reference || copy.reconciliation_no_reference}</p> : null}</div>{canManage ? entry.status === "unmatched" ? <Button type="button" variant="outline" onClick={() => openMatch(entry)} className="h-8 rounded-xl text-xs"><Link2 className="size-3.5" />{copy.reconciliation_match}</Button> : <Button type="button" variant="outline" onClick={() => { setUnmatchReason(""); setUnmatchingEntry(entry); }} className="h-8 rounded-xl text-xs"><RotateCcw className="size-3.5" />{copy.reconciliation_unmatch}</Button> : null}</article>;
        })}</div>}
        <Dialog open={createOpen} onOpenChange={setCreateOpen}><DialogContent compact className="max-w-md"><DialogHeader><DialogTitle>{copy.reconciliation_add_entry}</DialogTitle><DialogDescription>{copy.reconciliation_entry_description}</DialogDescription></DialogHeader><div className="grid gap-4 py-2"><div className="grid gap-2"><Label htmlFor="bank-booked-at">{copy.reconciliation_date}</Label><Input id="bank-booked-at" type="datetime-local" value={bookedAt} onChange={(event) => setBookedAt(event.target.value)} /></div><div className="grid gap-2"><Label htmlFor="bank-amount">{copy.reconciliation_amount}</Label><Input id="bank-amount" type="number" min="0.01" step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} /></div><div className="grid gap-2"><Label htmlFor="bank-reference">{copy.reconciliation_reference}</Label><Input id="bank-reference" maxLength={160} value={reference} onChange={(event) => setReference(event.target.value)} /></div><div className="grid gap-2"><Label htmlFor="bank-external-id">{copy.reconciliation_external_id}</Label><Input id="bank-external-id" maxLength={160} value={externalId} onChange={(event) => setExternalId(event.target.value)} /></div><div className="grid gap-2"><Label htmlFor="bank-counterparty">{copy.reconciliation_counterparty}</Label><Input id="bank-counterparty" maxLength={160} value={counterparty} onChange={(event) => setCounterparty(event.target.value)} /></div></div><DialogFooter><Button type="button" variant="cancel" onClick={() => setCreateOpen(false)} disabled={saving}>{copy.reconciliation_cancel}</Button><Button type="button" onClick={() => void createEntry()} disabled={saving}>{saving ? <Loader2 className="size-4 animate-spin" /> : null}{copy.reconciliation_save}</Button></DialogFooter></DialogContent></Dialog>
        <Dialog open={Boolean(matchingEntry)} onOpenChange={(open) => !open && setMatchingEntry(null)}><DialogContent compact className="max-w-md"><DialogHeader><DialogTitle>{copy.reconciliation_match}</DialogTitle><DialogDescription>{matchingEntry ? `${copy.reconciliation_match_description} ${formatCurrency(Number(matchingEntry.amount))}.` : ""}</DialogDescription></DialogHeader><div className="grid gap-2 py-2"><Label>{copy.reconciliation_select_payment}</Label><Select value={paymentId} onValueChange={setPaymentId}><SelectTrigger aria-label={copy.reconciliation_select_payment}><SelectValue placeholder={copy.reconciliation_select_payment} /></SelectTrigger><SelectContent>{matchablePayments.map((payment) => <SelectItem key={payment.id} value={String(payment.id)}>{formatCurrency(Number(payment.amount))} · {payment.reference || copy.reconciliation_no_reference}</SelectItem>)}</SelectContent></Select>{matchablePayments.length === 0 ? <p className="text-xs text-[var(--text-muted)]">{copy.reconciliation_no_matchable_payments}</p> : null}</div><DialogFooter><Button type="button" variant="cancel" onClick={() => setMatchingEntry(null)} disabled={saving}>{copy.reconciliation_cancel}</Button><Button type="button" onClick={() => void match()} disabled={saving || !paymentId}>{saving ? <Loader2 className="size-4 animate-spin" /> : null}{copy.reconciliation_match}</Button></DialogFooter></DialogContent></Dialog>
        <Dialog open={Boolean(unmatchingEntry)} onOpenChange={(open) => !open && setUnmatchingEntry(null)}><DialogContent compact className="max-w-md"><DialogHeader><DialogTitle>{copy.reconciliation_unmatch}</DialogTitle><DialogDescription>{copy.reconciliation_unmatch_description}</DialogDescription></DialogHeader><div className="grid gap-2 py-2"><Label htmlFor="unmatch-reason">{copy.reconciliation_reason}</Label><Input id="unmatch-reason" maxLength={1000} value={unmatchReason} onChange={(event) => setUnmatchReason(event.target.value)} /></div><DialogFooter><Button type="button" variant="cancel" onClick={() => setUnmatchingEntry(null)} disabled={saving}>{copy.reconciliation_cancel}</Button><Button type="button" onClick={() => void unmatch()} disabled={saving}>{saving ? <Loader2 className="size-4 animate-spin" /> : null}{copy.reconciliation_unmatch}</Button></DialogFooter></DialogContent></Dialog>
    </section>;
}
