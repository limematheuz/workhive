"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import { FilePenLine, Loader2, Pencil, Plus } from "lucide-react";

import { DeleteConfirmDialog } from "@/components/ui/delete-confirm-dialog";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useDictionary } from "@/lib/dictionary-context";
import { parseMoneyInput } from "@/lib/sales-ledger";
import type { SalesLedgerEntry, SalesLedgerManualRecordInput } from "@/services/sales-ledger.service";
import { toast } from "@/lib/toast";

type FormState = {
    documentNumber: string;
    entryDate: string;
    clientName: string;
    baseAmount: string;
    taxAmount: string;
    paymentStatus: "paid" | "pending";
};

type SalesLedgerRecordDialogProps = {
    entry: SalesLedgerEntry | null;
    open: boolean;
    busy: boolean;
    onOpenChange: (open: boolean) => void;
    onSave: (payload: SalesLedgerManualRecordInput) => Promise<void>;
    onDelete: () => Promise<void>;
};

function initialForm(entry: SalesLedgerEntry | null): FormState {
    return {
        documentNumber: entry?.document_number ?? "",
        entryDate: entry?.entry_date.substring(0, 10) ?? new Date().toISOString().substring(0, 10),
        clientName: entry?.client_name ?? "",
        baseAmount: entry ? String(entry.base_amount) : "",
        taxAmount: entry ? String(entry.tax_amount) : "",
        paymentStatus: entry?.payment_status ?? "pending",
    };
}

const inputClassName = "h-11 w-full rounded-xl px-3 text-sm";

export function SalesLedgerRecordDialog({
    entry,
    open,
    busy,
    onOpenChange,
    onSave,
    onDelete,
}: SalesLedgerRecordDialogProps) {
    const { dict } = useDictionary();
    const copy = dict.invoices;
    const [form, setForm] = useState(() => initialForm(entry));
    const [confirmingDelete, setConfirmingDelete] = useState(false);

    const submit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        const baseAmount = parseMoneyInput(form.baseAmount);
        const taxAmount = parseMoneyInput(form.taxAmount);
        if (baseAmount === null || taxAmount === null) {
            toast.error(copy.ledger_invalid_amount);
            return;
        }
        await onSave({
            document_number: form.documentNumber.trim(),
            entry_date: form.entryDate,
            client_name: form.clientName.trim(),
            base_amount: baseAmount,
            tax_amount: taxAmount,
            payment_status: form.paymentStatus,
        });
    };

    const title = entry ? copy.ledger_edit_record : copy.ledger_add_record;

    return (
        <>
            <Dialog open={open} onOpenChange={(nextOpen) => !busy && onOpenChange(nextOpen)}>
                <DialogContent className="w-[calc(100vw-2rem)] gap-0 overflow-hidden p-0 sm:max-w-xl">
                    <form onSubmit={submit} className="flex max-h-[min(92vh,calc(100%-2rem))] flex-col">
                        <DialogHeader className="border-b border-[var(--border-soft)] px-5 py-5 pr-14 sm:px-6">
                            <DialogTitle className="flex items-center gap-2.5 text-lg sm:text-xl">
                                <span className="flex size-9 items-center justify-center rounded-xl bg-[var(--brand-blue-soft)] text-accent">
                                    {entry ? <Pencil className="size-4" /> : <Plus className="size-4" />}
                                </span>
                                {title}
                            </DialogTitle>
                            <DialogDescription>{copy.ledger_record_description}</DialogDescription>
                        </DialogHeader>

                        <div className="grid gap-4 overflow-y-auto px-5 py-5 sm:grid-cols-2 sm:px-6">
                            <Field label={copy.invoice_number} htmlFor="ledger-document-number">
                                <Input id="ledger-document-number" required maxLength={50} value={form.documentNumber} onChange={(event) => setForm((current) => ({ ...current, documentNumber: event.target.value }))} className={inputClassName} />
                            </Field>
                            <Field label={copy.ledger_date} htmlFor="ledger-entry-date">
                                <DatePicker id="ledger-entry-date" required value={form.entryDate} onValueChange={(entryDate) => setForm((current) => ({ ...current, entryDate }))} className={inputClassName} />
                            </Field>
                            <Field label={copy.client} htmlFor="ledger-client-name" className="sm:col-span-2">
                                <Input id="ledger-client-name" required maxLength={160} value={form.clientName} onChange={(event) => setForm((current) => ({ ...current, clientName: event.target.value }))} className={inputClassName} />
                            </Field>
                            <Field label={copy.ledger_base} htmlFor="ledger-base-amount">
                                <Input id="ledger-base-amount" required inputMode="decimal" value={form.baseAmount} onChange={(event) => setForm((current) => ({ ...current, baseAmount: event.target.value }))} placeholder="0,00" className={inputClassName} />
                            </Field>
                            <Field label={copy.ledger_vat} htmlFor="ledger-tax-amount">
                                <Input id="ledger-tax-amount" required inputMode="decimal" value={form.taxAmount} onChange={(event) => setForm((current) => ({ ...current, taxAmount: event.target.value }))} placeholder="0,00" className={inputClassName} />
                            </Field>
                            <Field label={copy.ledger_collected} htmlFor="ledger-payment-status" className="sm:col-span-2">
                                <Select value={form.paymentStatus} onValueChange={(paymentStatus) => setForm((current) => ({ ...current, paymentStatus: paymentStatus as FormState["paymentStatus"] }))}>
                                    <SelectTrigger id="ledger-payment-status" className={inputClassName}><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="pending">{copy.ledger_status_pending}</SelectItem>
                                        <SelectItem value="paid">{copy.ledger_status_paid}</SelectItem>
                                    </SelectContent>
                                </Select>
                            </Field>
                        </div>

                        <DialogFooter className="dialog-glass-chrome border-t border-[var(--border-soft)] px-5 py-4 sm:px-6">
                            {entry && (
                                <Button type="button" variant="dangerSoft" onClick={() => setConfirmingDelete(true)} disabled={busy} className="sm:mr-auto">
                                    {copy.ledger_delete_record}
                                </Button>
                            )}
                            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>{copy.cancel}</Button>
                            <Button type="submit" disabled={busy}>
                                {busy ? <Loader2 className="size-4 animate-spin" /> : <FilePenLine className="size-4" />}
                                {busy ? copy.saving : copy.save_changes}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            <DeleteConfirmDialog
                open={confirmingDelete}
                onOpenChange={setConfirmingDelete}
                title={copy.ledger_delete_record}
                description={copy.ledger_delete_record_description}
                confirmText={copy.delete}
                cancelText={copy.cancel}
                onConfirm={async () => {
                    await onDelete();
                    setConfirmingDelete(false);
                }}
                isDeleting={busy}
                confirmVariant="soft-danger"
            />
        </>
    );
}

function Field({ label, htmlFor, className, children }: { label: string; htmlFor: string; className?: string; children: ReactNode }) {
    return (
        <div className={`flex min-w-0 flex-col gap-1.5 ${className ?? ""}`}>
            <Label htmlFor={htmlFor} className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--text-muted)]">{label}</Label>
            {children}
        </div>
    );
}
