import { BillingPartyCard } from "@/components/billing/BillingPartyCard";
import type { Dictionary } from "@/lib/dictionary-context";
import type { BillingPartyField, BillingPartyFields } from "@/lib/billing-party";
import { INVOICE_PAYMENT_METHODS } from "@/lib/invoice-payment-methods";
import type { InvoicePaymentMethod } from "@/types/invoice";
import { Checkbox } from "@/components/ui/checkbox";
import { DatePicker } from "@/components/ui/date-picker";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";

type InvoiceDetailEditModePanelProps = {
    dict: Dictionary;
    editingInvoiceNumber: string;
    editingIssueDate: string;
    editingDueDate: string;
    editingPaymentMethod: InvoicePaymentMethod;
    editingPricesIncludeTax: boolean;
    editingIssuerFields: BillingPartyFields;
    editingRecipientFields: BillingPartyFields;
    onEditingInvoiceNumberChange: (value: string) => void;
    onEditingIssueDateChange: (value: string) => void;
    onEditingDueDateChange: (value: string) => void;
    onEditingPaymentMethodChange: (value: InvoicePaymentMethod) => void;
    onEditingPricesIncludeTaxChange: (value: boolean) => void;
    onEditIssuerFieldChange: (field: BillingPartyField, value: string) => void;
    onEditRecipientFieldChange: (field: BillingPartyField, value: string) => void;
};

export function InvoiceDetailEditModePanel({
    dict,
    editingInvoiceNumber,
    editingIssueDate,
    editingDueDate,
    editingPaymentMethod,
    editingPricesIncludeTax,
    editingIssuerFields,
    editingRecipientFields,
    onEditingInvoiceNumberChange,
    onEditingIssueDateChange,
    onEditingDueDateChange,
    onEditingPaymentMethodChange,
    onEditingPricesIncludeTaxChange,
    onEditIssuerFieldChange,
    onEditRecipientFieldChange,
}: InvoiceDetailEditModePanelProps) {
    return (
        <section className="mx-auto mb-4 max-w-[112rem] rounded-[24px] bg-[color-mix(in_srgb,var(--btn-secondary-bg)_55%,var(--bg-secondary))] p-4 print:hidden sm:p-5">
            <header className="mb-4 flex flex-col gap-1 pb-4 sm:flex-row sm:items-end sm:justify-between">
                <div>
                    <h2 className="text-sm font-black text-[var(--text-main)]">{dict.invoices.edit_draft}</h2>
                    <p className="mt-1 text-xs text-[var(--text-muted)]">Revisa los datos y los conceptos antes de emitir la factura fiscal.</p>
                </div>
            </header>
            <div className="mb-5 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
                <div className="space-y-1">
                    <Label htmlFor="invoice-edit-final-number" className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                        {dict.invoices.final_number}
                    </Label>
                    <Input
                        id="invoice-edit-final-number"
                        type="text"
                        value={editingInvoiceNumber}
                        onChange={(event) => onEditingInvoiceNumberChange(event.target.value)}
                        placeholder={dict.invoices.optional_final_number_placeholder}
                        maxLength={50}
                        className="h-11 w-full rounded-xl px-3 font-mono text-sm"
                    />
                </div>
                <div className="space-y-1">
                    <Label htmlFor="invoice-edit-issue-date" className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                        {dict.invoices.issue_date}
                    </Label>
                    <DatePicker
                        id="invoice-edit-issue-date"
                        aria-label={dict.invoices.issue_date}
                        value={editingIssueDate}
                        onValueChange={onEditingIssueDateChange}
                        className="h-11"
                    />
                </div>
                <div className="space-y-1">
                    <Label htmlFor="invoice-edit-due-date" className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                        {dict.invoices.due_date}
                    </Label>
                    <DatePicker
                        id="invoice-edit-due-date"
                        aria-label={dict.invoices.due_date}
                        value={editingDueDate}
                        onValueChange={onEditingDueDateChange}
                        className="h-11"
                    />
                </div>
                <div className="space-y-1">
                    <Label htmlFor="invoice-edit-payment-method" className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                        {dict.invoices.payment_method}
                    </Label>
                    <Select
                        value={editingPaymentMethod}
                        onValueChange={(value) => onEditingPaymentMethodChange(value as InvoicePaymentMethod)}
                    >
                        <SelectTrigger id="invoice-edit-payment-method" className="h-11 w-full rounded-xl px-3 text-sm">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            {INVOICE_PAYMENT_METHODS.map((method) => (
                                <SelectItem key={method} value={method}>{dict.invoices.payment_methods[method]}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            </div>
            <div className="mb-5 flex items-center justify-between rounded-xl border border-[var(--border-soft)] bg-[var(--bg-tertiary)] px-3 py-2.5">
                <Label htmlFor="invoice-edit-prices-include-tax" className="cursor-pointer">
                    <span className="block text-xs font-semibold text-[var(--text-main)]">IVA incluido en el total</span>
                    <span className="mt-0.5 block text-[10px] text-[var(--text-muted)]">{editingPricesIncludeTax ? "Los precios editables incluyen IVA" : "Los precios editables son sin IVA"}</span>
                </Label>
                <Checkbox id="invoice-edit-prices-include-tax" checked={editingPricesIncludeTax} onCheckedChange={(checked) => onEditingPricesIncludeTaxChange(checked === true)} />
            </div>
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <BillingPartyCard
                    type="issuer"
                    dict={dict}
                    isEditing
                    setIsEditing={() => {}}
                    canToggleEditing={false}
                    structuredFields={editingIssuerFields}
                    onChangeField={onEditIssuerFieldChange}
                />
                <BillingPartyCard
                    type="recipient"
                    dict={dict}
                    isEditing
                    setIsEditing={() => {}}
                    canToggleEditing={false}
                    structuredFields={editingRecipientFields}
                    onChangeField={onEditRecipientFieldChange}
                />
            </div>
        </section>
    );
}
