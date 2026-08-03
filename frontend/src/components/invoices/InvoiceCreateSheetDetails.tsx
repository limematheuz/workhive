"use client";

import { Label } from "@/components/ui/label";
import { BillingPartyCard, BillingPartyFields } from "@/components/billing/BillingPartyCard";
import { InvoiceConceptsTable } from "./InvoiceConceptsTable";
import { InvoiceAdditionalInfo } from "./InvoiceAdditionalInfo";
import type { Client } from "@/services/client.service";
import type { InvoiceableTask } from "@/services/invoice.service";
import type { ConceptRow } from "@/hooks/useInvoiceForm";
import type { BillingPartyField } from "@/lib/billing-party";
import type { Dictionary } from "@/lib/dictionary-context";

interface InvoiceCreateSheetDetailsProps {
    dict: Dictionary;
    clients: Client[];
    selectedClientId: string;
    setSelectedClientId: (id: string) => void;
    isClientLocked: boolean;
    initialTasks: InvoiceableTask[];
    issueDate: string;
    setIssueDate: (value: string) => void;
    dueDate: string;
    setDueDate: (value: string) => void;
    invoiceNumber: string;
    setInvoiceNumber: (value: string) => void;
    maxDueDate: string;
    shippingAddress: string;
    setShippingAddress: (value: string) => void;
    concepts: ConceptRow[];
    handleAddManualRow: () => void;
    handleAddExternalLaundryRow: () => void;
    handleUpdateRow: <Field extends keyof ConceptRow>(
        id: string,
        field: Field,
        value: ConceptRow[Field]
    ) => void;
    handleDeleteRow: (id: string) => void;
    notesEnabled: boolean;
    setNotesEnabled: (value: boolean) => void;
    notes: string;
    setNotes: (value: string) => void;
    termsEnabled: boolean;
    setTermsEnabled: (value: boolean) => void;
    terms: string;
    setTerms: (value: string) => void;
    issuerFields: BillingPartyFields;
    recipientFields: BillingPartyFields;
    isEditingIssuer: boolean;
    setIsEditingIssuer: (value: boolean) => void;
    isEditingRecipient: boolean;
    setIsEditingRecipient: (value: boolean) => void;
    handleUpdateIssuerField: (field: BillingPartyField, value: string) => void;
    handleUpdateRecipientField: (field: BillingPartyField, value: string) => void;
}

export function InvoiceCreateSheetDetails({
    dict,
    clients,
    selectedClientId,
    setSelectedClientId,
    isClientLocked,
    initialTasks,
    issueDate,
    setIssueDate,
    dueDate,
    setDueDate,
    invoiceNumber,
    setInvoiceNumber,
    maxDueDate,
    shippingAddress,
    setShippingAddress,
    concepts,
    handleAddManualRow,
    handleAddExternalLaundryRow,
    handleUpdateRow,
    handleDeleteRow,
    notesEnabled,
    setNotesEnabled,
    notes,
    setNotes,
    termsEnabled,
    setTermsEnabled,
    terms,
    setTerms,
    issuerFields,
    recipientFields,
    isEditingIssuer,
    setIsEditingIssuer,
    isEditingRecipient,
    setIsEditingRecipient,
    handleUpdateIssuerField,
    handleUpdateRecipientField,
}: InvoiceCreateSheetDetailsProps) {
    return (
        <div className="lg:col-span-2 space-y-6">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                <div className="space-y-1">
                    <Label htmlFor="invoice-number" className="text-xs font-medium text-[var(--text-muted)]">
                        {dict.invoices?.invoice_number_label || "Número de factura"}
                    </Label>
                    <input
                        id="invoice-number"
                        type="text"
                        value={invoiceNumber}
                        onChange={(event) => setInvoiceNumber(event.target.value)}
                        placeholder="Automático si se deja vacío"
                        maxLength={50}
                        className="w-full rounded-xl border border-[var(--border-color)] bg-[var(--bg-primary)] px-3 py-2 font-mono text-sm text-[var(--text-main)] outline-none transition-colors focus:border-accent"
                    />
                </div>
                <div className="space-y-1">
                    <Label className="text-xs font-medium text-[var(--text-muted)]">
                        {dict.invoices?.issue_date} *
                    </Label>
                    <input
                        type="date"
                        value={issueDate}
                        onChange={(event) => setIssueDate(event.target.value)}
                        required
                        aria-label={dict.invoices?.issue_date}
                        className="w-full rounded-xl border border-[var(--border-color)] bg-[var(--bg-primary)] px-3 py-2 text-sm text-[var(--text-main)] outline-none transition-colors focus:border-accent"
                    />
                </div>
                <div className="space-y-1">
                    <Label className="text-xs font-medium text-[var(--text-muted)]">
                        {dict.invoices?.due_date}
                    </Label>
                    <input
                        type="date"
                        value={dueDate}
                        onChange={(event) => setDueDate(event.target.value)}
                        max={maxDueDate}
                        aria-label={dict.invoices?.due_date}
                        className="w-full rounded-xl border border-[var(--border-color)] bg-[var(--bg-primary)] px-3 py-2 text-sm text-[var(--text-main)] outline-none transition-colors focus:border-accent"
                    />
                </div>
            </div>

            {/* Client Selection */}
            <div className="space-y-1">
                <Label className="text-xs text-[var(--text-muted)] font-medium">
                    {dict.invoices?.client_select} *
                </Label>
                {isClientLocked ? (
                    <div className="w-full bg-[var(--bg-secondary)] border border-[var(--border-soft)] text-[var(--text-main)] rounded-xl px-3 py-2 text-sm">
                        {(() => {
                            const client = clients.find(
                                item => item.id.toString() === selectedClientId
                            );
                            const name =
                                client?.name
                                || initialTasks[0]?.client_name
                                || dict.invoices?.client_select_placeholder;
                            const legalNumber = client?.legal_number?.trim();
                            return `${name}${legalNumber ? ` (${legalNumber})` : ""}`;
                        })()}
                    </div>
                ) : (
                    <select
                        value={selectedClientId}
                        onChange={(e) => setSelectedClientId(e.target.value)}
                        required
                        aria-label={dict.invoices?.client_select}
                        className="w-full bg-[var(--bg-primary)] border border-[var(--border-color)] text-[var(--text-main)] rounded-xl px-3 py-2 text-sm outline-none focus:border-accent transition-colors"
                    >
                        <option value="" disabled>
                            {dict.invoices?.client_select_placeholder || "-- Selecciona un cliente --"}
                        </option>
                        {clients.map(c => (
                            <option key={c.id} value={c.id}>
                                {c.name}{c.legal_number && c.legal_number.trim() ? ` (${c.legal_number.trim()})` : ""}
                            </option>
                        ))}
                    </select>
                )}
            </div>

            {/* Concepts Table Section */}
            <InvoiceConceptsTable
                concepts={concepts}
                dict={dict}
                handleAddManualRow={handleAddManualRow}
                handleAddExternalLaundryRow={handleAddExternalLaundryRow}
                handleUpdateRow={handleUpdateRow}
                handleDeleteRow={handleDeleteRow}
            />

            <details className="group rounded-2xl border border-[var(--border-soft)] bg-[var(--bg-secondary)]/30">
                <summary className="cursor-pointer list-none px-4 py-3 text-sm font-bold text-[var(--text-main)] marker:hidden">
                    Datos adicionales
                    <span className="ml-2 text-xs font-normal text-[var(--text-muted)]">
                        Solo si necesitas modificar los datos fiscales o añadir notas
                    </span>
                </summary>
                <div className="space-y-5 border-t border-[var(--border-soft)] p-4">
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                        <BillingPartyCard
                            type="issuer"
                            dict={dict}
                            isEditing={isEditingIssuer}
                            setIsEditing={setIsEditingIssuer}
                            structuredFields={issuerFields}
                            onChangeField={handleUpdateIssuerField}
                        />
                        <BillingPartyCard
                            type="recipient"
                            dict={dict}
                            isEditing={isEditingRecipient}
                            setIsEditing={setIsEditingRecipient}
                            structuredFields={recipientFields}
                            onChangeField={handleUpdateRecipientField}
                        />
                    </div>
                    <div className="space-y-1">
                        <Label className="text-xs font-medium text-[var(--text-muted)]">
                            {dict.invoices?.shipping_address_label || "Dirección de envío (opcional)"}
                        </Label>
                        <textarea
                            value={shippingAddress}
                            onChange={(event) => setShippingAddress(event.target.value)}
                            rows={2}
                            maxLength={500}
                            placeholder={dict.invoices?.shipping_address_placeholder || "Solo si difiere de la dirección fiscal"}
                            className="w-full resize-none rounded-xl border border-[var(--border-color)] bg-[var(--bg-primary)] px-3 py-2 text-xs text-[var(--text-main)] outline-none transition-colors focus:border-accent"
                        />
                    </div>
                    <InvoiceAdditionalInfo
                        dict={dict}
                        notesEnabled={notesEnabled}
                        setNotesEnabled={setNotesEnabled}
                        notes={notes}
                        setNotes={setNotes}
                        termsEnabled={termsEnabled}
                        setTermsEnabled={setTermsEnabled}
                        terms={terms}
                        setTerms={setTerms}
                    />
                </div>
            </details>
        </div>
    );
}
