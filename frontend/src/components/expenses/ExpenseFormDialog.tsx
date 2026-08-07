"use client";

import { type FormEvent } from "react";
import { ReceiptText } from "lucide-react";

import { TaxRateSelect } from "@/components/billing/BillingSelectors";
import { DocumentFormDialog } from "@/components/billing/DocumentFormDialog";
import {
    DocumentFormInput,
    DocumentFormSelect,
    DocumentFormTextarea,
    documentControlClassName,
} from "@/components/billing/DocumentFormControls";
import { DocumentFormField } from "@/components/billing/DocumentFormField";
import { DocumentFormSection } from "@/components/billing/DocumentFormSection";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { useDictionary } from "@/lib/dictionary-context";
import {
    calculateExpenseTaxAmount,
    toExpenseAmount,
    type ExpenseFormState,
} from "@/lib/expense-form";
import { formatCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";
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

    const sidebar = (
        <section className="billing-surface overflow-hidden rounded-[24px]">
            <div className="border-b border-[var(--border-soft)] px-4 py-3.5">
                <div className="mb-3 h-1.5 w-full rounded-full bg-accent" />
                <h3 className="text-sm font-semibold text-[var(--text-main)]">
                    {text.calculated_total}
                </h3>
                <p className="mt-0.5 text-xs text-[var(--text-muted)]">Importes actualizados al momento</p>
            </div>
            <div className="space-y-2 p-4">
                <AmountPreview label={text.base_short} value={formatCurrency(baseAmount)} />
                <AmountPreview label={text.tax_short} value={formatCurrency(calculatedTaxAmount)} />
                <div className="mt-1 flex items-center justify-between rounded-2xl bg-[color-mix(in_srgb,var(--accent-color)_12%,var(--bg-tertiary))] px-4 py-3 text-[var(--text-main)]">
                    <span className="text-xs font-semibold uppercase tracking-wider">{text.total}</span>
                    <span className="font-mono text-base font-bold">{formatCurrency(calculatedTotal)}</span>
                </div>
            </div>
        </section>
    );

    const footerExtra = !editing ? (
        <div className="flex w-full items-center gap-2.5 sm:mr-auto sm:w-auto">
            <Checkbox
                id="expense-keep-adding"
                checked={keepAdding}
                onCheckedChange={(checked) => setKeepAdding(checked === true)}
                aria-label={text.keep_adding}
            />
            <Label
                htmlFor="expense-keep-adding"
                className="cursor-pointer text-xs font-semibold text-[var(--text-main)]"
            >
                {text.keep_adding}
            </Label>
        </div>
    ) : null;

    return (
        <DocumentFormDialog
            open={open}
            onOpenChange={onOpenChange}
            onSubmit={onSubmit}
            icon={<ReceiptText className="h-5 w-5" />}
            title={editing ? text.edit_expense : text.new_expense}
            description={
                editing
                    ? "Actualiza los datos del gasto y revisa el total calculado."
                    : "Registra un gasto de empresa con proveedor, categoría e IVA soportado."
            }
            cancelLabel={dict.clients?.form?.cancel || "Cancelar"}
            submitLabel={editing ? text.save_changes : text.add_expense}
            submittingLabel={dict.quotes?.saving || "Guardando..."}
            submitting={saving}
            submitDisabled={saving}
            onCancel={() => onOpenChange(false)}
            sidebar={sidebar}
            contentClassName="sm:max-w-[min(56rem,calc(100vw-2rem))]"
            footerStart={footerExtra}
        >
            <DocumentFormSection
                title="Datos del gasto"
                description="Fecha, proveedor y concepto del movimiento."
            >
                <div className="flex w-full min-w-0 flex-col gap-4">
                    <div className="grid w-full min-w-0 grid-cols-1 gap-4 @[28rem]:grid-cols-2">
                        <DocumentFormField id="expense-date" label={text.date}>
                            <DocumentFormInput
                                id="expense-date"
                                type="date"
                                required
                                value={form.expense_date}
                                onChange={(event) => setForm({ ...form, expense_date: event.target.value })}
                                aria-label={text.date}
                            />
                        </DocumentFormField>
                        <DocumentFormField id="expense-vendor" label={text.vendor}>
                            <DocumentFormInput
                                id="expense-vendor"
                                value={form.vendor}
                                onChange={(event) => setForm({ ...form, vendor: event.target.value })}
                                aria-label={text.vendor}
                                placeholder={text.vendor_placeholder}
                            />
                        </DocumentFormField>
                    </div>
                    <DocumentFormField id="expense-description" label={text.description}>
                        <DocumentFormInput
                            id="expense-description"
                            required
                            value={form.description}
                            onChange={(event) => setForm({ ...form, description: event.target.value })}
                            aria-label={text.description}
                            placeholder={text.description_placeholder}
                        />
                    </DocumentFormField>
                </div>
            </DocumentFormSection>

            <DocumentFormSection
                title="Clasificación e importe"
                description="Categoría, pago e IVA para el cálculo automático."
            >
                <div className="flex w-full min-w-0 flex-col gap-4">
                    <div className="grid w-full min-w-0 grid-cols-1 gap-4 @[28rem]:grid-cols-2">
                        <DocumentFormField id="expense-category" label={text.category}>
                            <DocumentFormSelect
                                id="expense-category"
                                value={form.category}
                                onChange={(event) => setForm({ ...form, category: event.target.value })}
                                aria-label={text.category}
                            >
                                {CATEGORY_OPTIONS.map((category) => (
                                    <option key={category} value={category}>
                                        {text.categories[category as keyof typeof text.categories] || category}
                                    </option>
                                ))}
                            </DocumentFormSelect>
                        </DocumentFormField>
                        <DocumentFormField id="expense-payment" label={text.payment_method}>
                            <DocumentFormSelect
                                id="expense-payment"
                                value={form.payment_method}
                                onChange={(event) => setForm({ ...form, payment_method: event.target.value })}
                                aria-label={text.payment_method}
                            >
                                <option value="">{text.payment_method_placeholder}</option>
                                {PAYMENT_METHOD_OPTIONS.map((method) => (
                                    <option key={method} value={method}>
                                        {text.payment_methods[method as keyof typeof text.payment_methods] || method}
                                    </option>
                                ))}
                            </DocumentFormSelect>
                        </DocumentFormField>
                    </div>
                    <div className="grid w-full min-w-0 grid-cols-1 gap-4 @[28rem]:grid-cols-2">
                        <DocumentFormField id="expense-base" label={text.base_amount}>
                            <DocumentFormInput
                                id="expense-base"
                                type="number"
                                min="0"
                                step="0.01"
                                required
                                value={form.base_amount}
                                onChange={(event) => setForm({ ...form, base_amount: event.target.value })}
                                aria-label={text.base_amount}
                            />
                        </DocumentFormField>
                        <DocumentFormField id="expense-tax-rate" label={text.tax_rate}>
                            <TaxRateSelect
                                value={taxRate}
                                onChange={(rate) => setForm({ ...form, tax_rate: rate.toString() })}
                                className={cn(documentControlClassName, "cursor-pointer text-left font-sans")}
                            />
                        </DocumentFormField>
                    </div>
                    <DocumentFormField id="expense-notes" label={text.notes}>
                        <div className="grid gap-1.5">
                            <DocumentFormTextarea
                                id="expense-notes"
                                value={form.notes}
                                maxLength={500}
                                onChange={(event) => setForm({ ...form, notes: event.target.value })}
                                aria-label={text.notes}
                                rows={3}
                            />
                            <span className="text-xs font-medium text-[var(--text-muted)]">
                                {text.notes_hint}
                            </span>
                        </div>
                    </DocumentFormField>
                </div>
            </DocumentFormSection>
        </DocumentFormDialog>
    );
}

function AmountPreview({
    label,
    value,
}: {
    label: string;
    value: string;
}) {
    return (
        <div className="rounded-xl bg-[var(--bg-tertiary)] px-3 py-2.5">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">{label}</p>
            <p className="mt-1 font-mono text-sm font-semibold text-[var(--text-main)]">{value}</p>
        </div>
    );
}
