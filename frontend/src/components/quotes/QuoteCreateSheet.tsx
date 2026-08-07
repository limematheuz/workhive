"use client";

import { useQuoteForm } from "@/hooks/useQuoteForm";
import { Client } from "@/services/client.service";
import { Quote } from "@/types/quote";
import { DocumentFormDialog } from "@/components/billing/DocumentFormDialog";
import { DocumentSummary } from "@/components/billing/DocumentSummary";
import { Loader2, FileText } from "lucide-react";
import { QuoteFormAdvancedSection } from "./QuoteFormAdvancedSection";
import { QuoteFormDetailsSection } from "./QuoteFormDetailsSection";
import { QuoteFormLinesSection } from "./QuoteFormLinesSection";

interface QuoteCreateSheetProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    clients: Client[];
    onQuoteCreated: () => void;
    quoteToEdit?: Quote | null;
}

export function QuoteCreateSheet({
    open,
    onOpenChange,
    clients: initialClients,
    onQuoteCreated,
    quoteToEdit = null,
}: QuoteCreateSheetProps) {
    const {
        dict,
        clients,
        selectedClientId,
        setSelectedClientId,
        title,
        setTitle,
        validUntil,
        setValidUntil,
        shippingAddress,
        setShippingAddress,
        concepts,
        discount,
        setDiscount,
        taxRateGlobal,
        equivalenceSurcharge,
        setEquivalenceSurcharge,
        retention,
        setRetention,
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
        loadingClients,
        submitting,
        handleAddManualRow,
        handleDuplicateRow,
        handleUpdateRow,
        handleDeleteRow,
        handleGlobalTaxRateChange,
        subtotal,
        baseAmount,
        taxAmount,
        surchargeAmount,
        retentionAmount,
        totalGeneral,
        handleCreateQuote,
        handleClose,
        handleUpdateIssuerField,
        handleUpdateRecipientField,
        issuerFields,
        recipientFields,
        isEditingIssuer,
        setIsEditingIssuer,
        isEditingRecipient,
        setIsEditingRecipient,
    } = useQuoteForm({
        open,
        onOpenChange,
        clients: initialClients,
        onQuoteCreated,
        quoteToEdit,
    });

    const sidebar = (
        <DocumentSummary
            dict={dict}
            title={dict.quotes?.summary_title || "Resumen del Presupuesto"}
            subtotal={subtotal}
            discount={discount}
            setDiscount={setDiscount}
            taxRateGlobal={taxRateGlobal}
            handleGlobalTaxRateChange={handleGlobalTaxRateChange}
            equivalenceSurcharge={equivalenceSurcharge}
            setEquivalenceSurcharge={setEquivalenceSurcharge}
            retention={retention}
            setRetention={setRetention}
            baseAmount={baseAmount}
            taxAmount={taxAmount}
            surchargeAmount={surchargeAmount}
            retentionAmount={retentionAmount}
            totalGeneral={totalGeneral}
        />
    );

    return (
        <DocumentFormDialog
            open={open}
            onOpenChange={handleClose}
            onSubmit={handleCreateQuote}
            icon={<FileText className="h-5 w-5" />}
            title={quoteToEdit ? (dict.quotes?.edit_title || "Editar presupuesto") : (dict.quotes?.create_title || "Nuevo presupuesto")}
            description={quoteToEdit ? (dict.quotes?.edit_description || "Actualiza los detalles y conceptos del presupuesto.") : (dict.quotes?.create_description || "Crea un presupuesto claro, con sus conceptos y condiciones comerciales.")}
            cancelLabel={dict.clients?.form?.cancel || "Cancelar"}
            submitLabel={quoteToEdit ? (dict.quotes?.save_changes || "Guardar cambios") : (dict.quotes?.save || "Crear presupuesto")}
            submittingLabel={dict.quotes?.saving || "Guardando..."}
            submitting={submitting}
            submitDisabled={concepts.length === 0 || loadingClients}
            onCancel={handleClose}
            sidebar={sidebar}
        >
            {loadingClients ? (
                <div className="flex min-h-[250px] items-center justify-center py-12">
                    <Loader2 className="h-6 w-6 animate-spin text-accent" />
                </div>
            ) : (
                <>
                    <QuoteFormDetailsSection
                        dict={dict}
                        title={title}
                        setTitle={setTitle}
                        selectedClientId={selectedClientId}
                        setSelectedClientId={setSelectedClientId}
                        clients={clients}
                        validUntil={validUntil}
                        setValidUntil={setValidUntil}
                    />
                    <QuoteFormLinesSection
                        concepts={concepts}
                        dict={dict}
                        handleAddManualRow={handleAddManualRow}
                        handleDuplicateRow={handleDuplicateRow}
                        handleUpdateRow={handleUpdateRow}
                        handleDeleteRow={handleDeleteRow}
                    />
                    <QuoteFormAdvancedSection
                        dict={dict}
                        shippingAddress={shippingAddress}
                        setShippingAddress={setShippingAddress}
                        notesEnabled={notesEnabled}
                        setNotesEnabled={setNotesEnabled}
                        notes={notes}
                        setNotes={setNotes}
                        termsEnabled={termsEnabled}
                        setTermsEnabled={setTermsEnabled}
                        terms={terms}
                        setTerms={setTerms}
                        signatureUrl={signatureUrl}
                        setSignatureUrl={setSignatureUrl}
                        issuerFields={issuerFields}
                        recipientFields={recipientFields}
                        isEditingIssuer={isEditingIssuer}
                        setIsEditingIssuer={setIsEditingIssuer}
                        isEditingRecipient={isEditingRecipient}
                        setIsEditingRecipient={setIsEditingRecipient}
                        handleUpdateIssuerField={handleUpdateIssuerField}
                        handleUpdateRecipientField={handleUpdateRecipientField}
                    />
                </>
            )}
        </DocumentFormDialog>
    );
}
