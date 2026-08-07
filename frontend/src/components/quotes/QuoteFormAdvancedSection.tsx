"use client";

import { BillingPartyCard } from "@/components/billing/BillingPartyCard";
import { DocumentFormAdvancedPanel } from "@/components/billing/DocumentFormAdvancedPanel";
import { DocumentFormField } from "@/components/billing/DocumentFormField";
import { DocumentFormTextarea } from "@/components/billing/DocumentFormControls";
import { SignatureUpload } from "@/components/billing/SignatureUpload";
import { InvoiceAdditionalInfo } from "@/components/invoices/InvoiceAdditionalInfo";
import type { BillingPartyField, BillingPartyFields } from "@/lib/billing-party";
import type { Dictionary } from "@/lib/dictionary-context";

type QuoteFormAdvancedSectionProps = {
    dict: Dictionary;
    shippingAddress: string;
    setShippingAddress: (value: string) => void;
    notesEnabled: boolean;
    setNotesEnabled: (value: boolean) => void;
    notes: string;
    setNotes: (value: string) => void;
    termsEnabled: boolean;
    setTermsEnabled: (value: boolean) => void;
    terms: string;
    setTerms: (value: string) => void;
    signatureUrl: string | null;
    setSignatureUrl: (url: string | null) => void;
    issuerFields: BillingPartyFields;
    recipientFields: BillingPartyFields;
    isEditingIssuer: boolean;
    setIsEditingIssuer: (value: boolean) => void;
    isEditingRecipient: boolean;
    setIsEditingRecipient: (value: boolean) => void;
    handleUpdateIssuerField: (field: BillingPartyField, value: string) => void;
    handleUpdateRecipientField: (field: BillingPartyField, value: string) => void;
};

export function QuoteFormAdvancedSection({
    dict,
    shippingAddress,
    setShippingAddress,
    notesEnabled,
    setNotesEnabled,
    notes,
    setNotes,
    termsEnabled,
    setTermsEnabled,
    terms,
    setTerms,
    signatureUrl,
    setSignatureUrl,
    issuerFields,
    recipientFields,
    isEditingIssuer,
    setIsEditingIssuer,
    isEditingRecipient,
    setIsEditingRecipient,
    handleUpdateIssuerField,
    handleUpdateRecipientField,
}: QuoteFormAdvancedSectionProps) {
    return (
        <DocumentFormAdvancedPanel
            title="Opciones avanzadas"
            description="Datos fiscales, envío, notas y firma"
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
                id="quote-shipping"
                label={dict.invoices?.shipping_address_label || "Dirección de envío (opcional)"}
            >
                <DocumentFormTextarea
                    id="quote-shipping"
                    value={shippingAddress}
                    onChange={(event) => setShippingAddress(event.target.value)}
                    rows={2}
                    maxLength={500}
                    placeholder={dict.invoices?.shipping_address_placeholder || "Solo si difiere de la dirección fiscal"}
                />
            </DocumentFormField>

            <InvoiceAdditionalInfo
                dict={dict}
                variant="quote"
                notesEnabled={notesEnabled}
                setNotesEnabled={setNotesEnabled}
                notes={notes}
                setNotes={setNotes}
                termsEnabled={termsEnabled}
                setTermsEnabled={setTermsEnabled}
                terms={terms}
                setTerms={setTerms}
            />

            <SignatureUpload
                signatureUrl={signatureUrl}
                onSignatureChange={setSignatureUrl}
                dict={dict}
            />
        </DocumentFormAdvancedPanel>
    );
}
