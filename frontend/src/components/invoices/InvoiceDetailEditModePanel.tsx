import { BillingPartyCard } from "@/components/billing/BillingPartyCard";
import type { Dictionary } from "@/lib/dictionary-context";
import type { BillingPartyField, BillingPartyFields } from "@/lib/billing-party";

type InvoiceDetailEditModePanelProps = {
    dict: Dictionary;
    editingInvoiceNumber: string;
    editingIssueDate: string;
    editingDueDate: string;
    editingIssuerFields: BillingPartyFields;
    editingRecipientFields: BillingPartyFields;
    onEditingInvoiceNumberChange: (value: string) => void;
    onEditingIssueDateChange: (value: string) => void;
    onEditingDueDateChange: (value: string) => void;
    onEditIssuerFieldChange: (field: BillingPartyField, value: string) => void;
    onEditRecipientFieldChange: (field: BillingPartyField, value: string) => void;
};

export function InvoiceDetailEditModePanel({
    dict,
    editingInvoiceNumber,
    editingIssueDate,
    editingDueDate,
    editingIssuerFields,
    editingRecipientFields,
    onEditingInvoiceNumberChange,
    onEditingIssueDateChange,
    onEditingDueDateChange,
    onEditIssuerFieldChange,
    onEditRecipientFieldChange,
}: InvoiceDetailEditModePanelProps) {
    return (
        <div className="mx-auto mb-4 max-w-[112rem] rounded-[24px] border border-[var(--border-soft)] bg-[var(--bg-card-solid)] p-5 print:hidden">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-5">
                <div className="space-y-1">
                    <label htmlFor="invoice-edit-final-number" className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                        {dict.invoices.final_number}
                    </label>
                    <input
                        id="invoice-edit-final-number"
                        type="text"
                        value={editingInvoiceNumber}
                        onChange={(event) => onEditingInvoiceNumberChange(event.target.value)}
                        placeholder={dict.invoices.optional_final_number_placeholder}
                        maxLength={50}
                        className="w-full bg-[var(--bg-primary)] border border-[var(--border-color)] text-[var(--text-main)] rounded-xl px-3 py-2 text-sm outline-none focus:border-accent transition-colors font-mono"
                    />
                </div>
                <div className="space-y-1">
                    <label htmlFor="invoice-edit-issue-date" className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                        {dict.invoices.issue_date}
                    </label>
                    <input
                        id="invoice-edit-issue-date"
                        type="date"
                        aria-label={dict.invoices.issue_date}
                        value={editingIssueDate}
                        onChange={(event) => onEditingIssueDateChange(event.target.value)}
                        required
                        className="w-full bg-[var(--bg-primary)] border border-[var(--border-color)] text-[var(--text-main)] rounded-xl px-3 py-2 text-sm outline-none focus:border-accent transition-colors"
                    />
                </div>
                <div className="space-y-1">
                    <label htmlFor="invoice-edit-due-date" className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                        {dict.invoices.due_date}
                    </label>
                    <input
                        id="invoice-edit-due-date"
                        type="date"
                        aria-label={dict.invoices.due_date}
                        value={editingDueDate}
                        onChange={(event) => onEditingDueDateChange(event.target.value)}
                        className="w-full bg-[var(--bg-primary)] border border-[var(--border-color)] text-[var(--text-main)] rounded-xl px-3 py-2 text-sm outline-none focus:border-accent transition-colors"
                    />
                </div>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
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
        </div>
    );
}
