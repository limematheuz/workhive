"use client";

import { BillingPartyCard, BillingPartyFields } from "@/components/billing/BillingPartyCard";
import { DocumentFormAdvancedPanel } from "@/components/billing/DocumentFormAdvancedPanel";
import {
    DocumentFormInput,
    DocumentFormSelect,
    DocumentFormTextarea,
} from "@/components/billing/DocumentFormControls";
import { DocumentFormField } from "@/components/billing/DocumentFormField";
import { DocumentFormSection } from "@/components/billing/DocumentFormSection";
import { InvoiceConceptsTable } from "./InvoiceConceptsTable";
import { InvoiceAdditionalInfo } from "./InvoiceAdditionalInfo";
import type { Client } from "@/services/client.service";
import type { InvoiceableTask } from "@/services/invoice.service";
import type { ConceptRow } from "@/hooks/useInvoiceForm";
import type { BillingPartyField } from "@/lib/billing-party";
import type { Dictionary } from "@/lib/dictionary-context";
import { INVOICE_PAYMENT_METHODS, getInvoicePaymentMethodLabel } from "@/lib/invoice-payment-methods";
import type { InvoicePaymentMethod } from "@/types/invoice";

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
    paymentMethod: InvoicePaymentMethod;
    setPaymentMethod: (value: InvoicePaymentMethod) => void;
    maxDueDate: string;
    shippingAddress: string;
    setShippingAddress: (value: string) => void;
    concepts: ConceptRow[];
    handleAddManualRow: () => void;
    handleDuplicateRow: (id: string) => void;
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
    paymentMethod,
    setPaymentMethod,
    maxDueDate,
    shippingAddress,
    setShippingAddress,
    concepts,
    handleAddManualRow,
    handleDuplicateRow,
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
    const lockedClientLabel = (() => {
        const client = clients.find((item) => item.id.toString() === selectedClientId);
        const name =
            client?.name
            || initialTasks[0]?.client_name
            || dict.invoices?.client_select_placeholder;
        const legalNumber = client?.legal_number?.trim();
        return `${name}${legalNumber ? ` (${legalNumber})` : ""}`;
    })();

    return (
        <>
            <DocumentFormSection
                title="Datos de la factura"
                description="Cliente, número y fechas. El número puede generarse automáticamente."
            >
                <div className="flex w-full min-w-0 flex-col gap-4">
                    <DocumentFormField
                        id="invoice-client"
                        label={`${dict.invoices?.client_select || "Cliente"} *`}
                    >
                        {isClientLocked ? (
                            <div className="flex h-11 min-w-0 items-center rounded-xl border border-[var(--border-soft)] bg-[var(--bg-card-solid)] px-3 text-sm text-[var(--text-main)]">
                                <span className="truncate">{lockedClientLabel}</span>
                            </div>
                        ) : (
                            <DocumentFormSelect
                                id="invoice-client"
                                value={selectedClientId}
                                onChange={(e) => setSelectedClientId(e.target.value)}
                                required
                                aria-label={dict.invoices?.client_select}
                            >
                                <option value="" disabled>
                                    {dict.invoices?.client_select_placeholder || "-- Selecciona un cliente --"}
                                </option>
                                {clients.map((client) => (
                                    <option key={client.id} value={client.id}>
                                        {client.name}
                                        {client.legal_number?.trim() ? ` (${client.legal_number.trim()})` : ""}
                                    </option>
                                ))}
                            </DocumentFormSelect>
                        )}
                    </DocumentFormField>

                    <div className="grid w-full min-w-0 grid-cols-1 gap-4 @[28rem]:grid-cols-2">
                        <DocumentFormField
                            id="invoice-number"
                            label={dict.invoices?.invoice_number_label || "Número de factura"}
                        >
                            <DocumentFormInput
                                id="invoice-number"
                                type="text"
                                value={invoiceNumber}
                                onChange={(event) => setInvoiceNumber(event.target.value)}
                                placeholder="Opcional"
                                maxLength={50}
                                className="font-mono"
                            />
                        </DocumentFormField>
                        <DocumentFormField
                            id="invoice-issue-date"
                            label={`${dict.invoices?.issue_date || "Fecha de emisión"} *`}
                        >
                            <DocumentFormInput
                                id="invoice-issue-date"
                                type="date"
                                value={issueDate}
                                onChange={(event) => setIssueDate(event.target.value)}
                                required
                                aria-label={dict.invoices?.issue_date}
                            />
                        </DocumentFormField>
                        <DocumentFormField
                            id="invoice-due-date"
                            label={dict.invoices?.due_date || "Fecha de vencimiento"}
                        >
                            <DocumentFormInput
                                id="invoice-due-date"
                                type="date"
                                value={dueDate}
                                onChange={(event) => setDueDate(event.target.value)}
                                max={maxDueDate}
                                aria-label={dict.invoices?.due_date}
                            />
                        </DocumentFormField>
                        <DocumentFormField
                            id="invoice-payment-method"
                            label={dict.invoices?.payment_method || "Forma de pago"}
                        >
                            <DocumentFormSelect
                                id="invoice-payment-method"
                                value={paymentMethod}
                                onChange={(event) => setPaymentMethod(event.target.value as InvoicePaymentMethod)}
                            >
                                {INVOICE_PAYMENT_METHODS.map((method) => (
                                    <option key={method} value={method}>
                                        {getInvoicePaymentMethodLabel(method, dict.invoices.payment_methods)}
                                    </option>
                                ))}
                            </DocumentFormSelect>
                        </DocumentFormField>
                    </div>
                </div>
            </DocumentFormSection>

            <InvoiceConceptsTable
                concepts={concepts}
                dict={dict}
                handleAddManualRow={handleAddManualRow}
                handleDuplicateRow={handleDuplicateRow}
                handleAddExternalLaundryRow={handleAddExternalLaundryRow}
                handleUpdateRow={handleUpdateRow}
                handleDeleteRow={handleDeleteRow}
            />

            <DocumentFormAdvancedPanel
                title="Datos adicionales"
                description="Solo si necesitas modificar los datos fiscales o añadir notas"
            >
                <div className="grid grid-cols-1 gap-4 @[32rem]:grid-cols-2">
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
                <DocumentFormField
                    id="invoice-shipping"
                    label={dict.invoices?.shipping_address_label || "Dirección de envío (opcional)"}
                >
                    <DocumentFormTextarea
                        id="invoice-shipping"
                        value={shippingAddress}
                        onChange={(event) => setShippingAddress(event.target.value)}
                        rows={2}
                        maxLength={500}
                        placeholder={dict.invoices?.shipping_address_placeholder || "Solo si difiere de la dirección fiscal"}
                    />
                </DocumentFormField>
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
            </DocumentFormAdvancedPanel>
        </>
    );
}
