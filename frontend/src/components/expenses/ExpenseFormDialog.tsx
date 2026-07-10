"use client";

import { type FormEvent, type ReactNode } from "react";
import { Loader2, Plus } from "lucide-react";

import { TaxRateSelect } from "@/components/billing/BillingSelectors";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { useDictionary } from "@/lib/dictionary-context";
import {
    calculateExpenseTaxAmount,
    toExpenseAmount,
    type ExpenseFormState,
} from "@/lib/expense-form";
import { formatCurrency } from "@/lib/format";
import { CATEGORY_OPTIONS, PAYMENT_METHOD_OPTIONS } from "./expense-options";

type ExpenseFormDialogProps = {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    editing: boolean;
    form: ExpenseFormState;
    setForm: (next: ExpenseFormState) => void;
    keepAdding: boolean;
    setKeepAdding: (value: boolean) => void;
    saving: boolean;
    onSubmit: (event: FormEvent<HTMLFormElement>) => void;
};

export function ExpenseFormDialog({
    open,
    onOpenChange,
    editing,
    form,
    setForm,
    keepAdding,
    setKeepAdding,
    saving,
    onSubmit,
}: ExpenseFormDialogProps) {
    const { dict } = useDictionary();
    const text = dict.expenses;
    const baseAmount = toExpenseAmount(form.base_amount);
    const taxRate = Number(form.tax_rate || 0);
    const calculatedTaxAmount = calculateExpenseTaxAmount(baseAmount, taxRate);
    const calculatedTotal = baseAmount + calculatedTaxAmount;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
                <DialogHeader>
                    <DialogTitle>{editing ? text.edit_expense : text.new_expense}</DialogTitle>
                </DialogHeader>
                <form onSubmit={onSubmit} className="grid gap-4">
                    <div className="grid gap-3 sm:grid-cols-2">
                        <Field label={text.date}>
                            <input
                                type="date"
                                required
                                value={form.expense_date}
                                onChange={(event) => setForm({ ...form, expense_date: event.target.value })}
                                aria-label={text.date}
                                className="expense-input"
                            />
                        </Field>
                        <Field label={text.vendor}>
                            <input
                                value={form.vendor}
                                onChange={(event) => setForm({ ...form, vendor: event.target.value })}
                                aria-label={text.vendor}
                                className="expense-input"
                                placeholder={text.vendor_placeholder}
                            />
                        </Field>
                    </div>
                    <Field label={text.description}>
                        <input
                            required
                            value={form.description}
                            onChange={(event) => setForm({ ...form, description: event.target.value })}
                            aria-label={text.description}
                            className="expense-input"
                            placeholder={text.description_placeholder}
                        />
                    </Field>
                    <div className="grid gap-3 sm:grid-cols-2">
                        <Field label={text.category}>
                            <select
                                value={form.category}
                                onChange={(event) => setForm({ ...form, category: event.target.value })}
                                aria-label={text.category}
                                className="expense-input"
                            >
                                {CATEGORY_OPTIONS.map((category) => (
                                    <option key={category} value={category}>
                                        {text.categories[category as keyof typeof text.categories] || category}
                                    </option>
                                ))}
                            </select>
                        </Field>
                        <Field label={text.payment_method}>
                            <select
                                value={form.payment_method}
                                onChange={(event) => setForm({ ...form, payment_method: event.target.value })}
                                aria-label={text.payment_method}
                                className="expense-input cursor-pointer"
                            >
                                <option value="">{text.payment_method_placeholder}</option>
                                {PAYMENT_METHOD_OPTIONS.map((method) => (
                                    <option key={method} value={method}>
                                        {text.payment_methods[method as keyof typeof text.payment_methods] || method}
                                    </option>
                                ))}
                            </select>
                        </Field>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                        <Field label={text.base_amount}>
                            <input
                                type="number"
                                min="0"
                                step="0.01"
                                required
                                value={form.base_amount}
                                onChange={(event) => setForm({ ...form, base_amount: event.target.value })}
                                aria-label={text.base_amount}
                                className="expense-input"
                            />
                        </Field>
                        <Field label={text.tax_rate}>
                            <TaxRateSelect
                                value={taxRate}
                                onChange={(rate) => setForm({ ...form, tax_rate: rate.toString() })}
                                className="expense-input cursor-pointer"
                            />
                        </Field>
                    </div>
                    <div className="grid gap-2 rounded-2xl border border-[var(--border-soft)] bg-[var(--bg-secondary)]/75 p-3 sm:grid-cols-3">
                        <AmountPreview label={text.base_short} value={formatCurrency(baseAmount)} />
                        <AmountPreview label={text.tax_short} value={formatCurrency(calculatedTaxAmount)} />
                        <AmountPreview label={text.calculated_total} value={formatCurrency(calculatedTotal)} strong />
                    </div>
                    <Field label={text.notes}>
                        <div className="grid gap-1">
                            <textarea
                                value={form.notes}
                                maxLength={500}
                                onChange={(event) => setForm({ ...form, notes: event.target.value })}
                                aria-label={text.notes}
                                className="expense-input min-h-20 resize-y"
                            />
                            <span className="text-xs font-medium normal-case tracking-normal text-[var(--text-muted)]">
                                {text.notes_hint}
                            </span>
                        </div>
                    </Field>
                    {!editing && (
                        <label className="flex items-center gap-2 rounded-2xl border border-[var(--border-soft)] bg-[var(--bg-secondary)]/65 px-3 py-2 text-sm font-bold text-[var(--text-main)]">
                            <input
                                type="checkbox"
                                checked={keepAdding}
                                onChange={(event) => setKeepAdding(event.target.checked)}
                                aria-label={text.keep_adding}
                                className="h-4 w-4 accent-[var(--accent-color)]"
                            />
                            {text.keep_adding}
                        </label>
                    )}
                    <button
                        type="submit"
                        disabled={saving}
                        className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-2xl border border-[var(--border-soft)] bg-[var(--btn-primary-bg)] px-4 text-sm font-black text-[var(--btn-primary-text)] transition hover:bg-[var(--btn-primary-hover-bg)] disabled:opacity-60"
                    >
                        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                        {editing ? text.save_changes : text.add_expense}
                    </button>
                </form>
            </DialogContent>
        </Dialog>
    );
}

function AmountPreview({
    label,
    value,
    strong = false,
}: {
    label: string;
    value: string;
    strong?: boolean;
}) {
    return (
        <div className="rounded-xl border border-[var(--border-soft)] bg-[var(--bg-tertiary)]/70 px-3 py-2">
            <p className="text-[10px] font-black uppercase tracking-wide text-[var(--text-muted)]">{label}</p>
            <p className={`mt-1 text-sm ${strong ? "font-black text-accent" : "font-bold text-[var(--text-main)]"}`}>
                {value}
            </p>
        </div>
    );
}

function Field({
    label,
    children,
}: {
    label: string;
    children: ReactNode;
}) {
    return (
        <label className="grid gap-1.5">
            <span className="text-[11px] font-black uppercase tracking-wide text-[var(--text-muted)]">{label}</span>
            {children}
        </label>
    );
}
