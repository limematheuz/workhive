"use client";

import { useQuoteForm } from "@/hooks/useQuoteForm";
import { Client } from "@/services/client.service";
import { Quote } from "@/types/quote";
import { DocumentFormDialog } from "@/components/billing/DocumentFormDialog";
import { DocumentFormSection } from "@/components/billing/DocumentFormSection";
import { Label } from "@/components/ui/label";
import { ChevronDown, Loader2, FileText } from "lucide-react";
import { BillingPartyCard } from "@/components/billing/BillingPartyCard";
import { DocumentSummary } from "@/components/billing/DocumentSummary";
import { SignatureUpload } from "@/components/billing/SignatureUpload";
import { QuoteItemsTable } from "./QuoteItemsTable";
import { InvoiceAdditionalInfo } from "@/components/invoices/InvoiceAdditionalInfo";

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
                <div className="space-y-6">
                    <DocumentFormSection
                        title="Datos del presupuesto"
                        description="Define qué se ofrece y hasta cuándo se mantiene la propuesta."
                    >
                        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                                        <div className="space-y-1">
                                            <Label className="text-xs font-medium text-[var(--text-muted)]">
                                                {dict.quotes?.title_label || "Título *"}
                                            </Label>
                                            <input
                                                type="text"
                                                value={title}
                                                onChange={(event) => setTitle(event.target.value)}
                                                required
                                                maxLength={255}
                                                placeholder={dict.quotes?.title_placeholder || "Ej: Limpieza de apartamento turístico"}
                                                className="h-11 w-full rounded-xl border border-[var(--border-color)] bg-[var(--bg-card-solid)] px-3 text-sm text-[var(--text-main)] outline-none transition-colors focus:border-accent"
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <Label className="text-xs font-medium text-[var(--text-muted)]">
                                                {dict.quotes?.valid_until_label || "Válido hasta"}
                                            </Label>
                                            <input
                                                type="date"
                                                value={validUntil}
                                                onChange={(event) => setValidUntil(event.target.value)}
                                                aria-label={dict.quotes?.valid_until_label || "Válido hasta"}
                                                className="h-11 w-full rounded-xl border border-[var(--border-color)] bg-[var(--bg-card-solid)] px-3 text-sm text-[var(--text-main)] outline-none transition-colors focus:border-accent"
                                            />
                                        </div>
                        </div>
                    </DocumentFormSection>

                    <DocumentFormSection
                        title="Cliente"
                        description="Selecciona un cliente guardado o crea el presupuesto sin asociarlo todavía."
                    >
                        <div className="space-y-1">
                                        <Label className="text-xs text-[var(--text-muted)] font-medium">
                                            {dict.quotes?.client_label || "Cliente *"}
                                        </Label>
                                        <select
                                            value={selectedClientId}
                                            onChange={(e) => setSelectedClientId(e.target.value)}
                                            aria-label={dict.quotes?.client_label || "Cliente"}
                                            className="h-11 w-full rounded-xl border border-[var(--border-color)] bg-[var(--bg-card-solid)] px-3 text-sm text-[var(--text-main)] outline-none transition-colors focus:border-accent"
                                        >
                                            <option value="">
                                                {dict.quotes?.new_unregistered_client || "-- Nuevo Cliente / No registrado --"}
                                            </option>
                                            {clients.map(c => (
                                                <option key={c.id} value={c.id}>
                                                    {c.name}{c.legal_number && c.legal_number.trim() ? ` (${c.legal_number.trim()})` : ""}
                                                </option>
                                            ))}
                                        </select>
                        </div>
                    </DocumentFormSection>

                    <QuoteItemsTable
                        concepts={concepts}
                        dict={dict}
                        handleAddManualRow={handleAddManualRow}
                        handleDuplicateRow={handleDuplicateRow}
                        handleUpdateRow={handleUpdateRow}
                        handleDeleteRow={handleDeleteRow}
                    />

                    <details className="group rounded-2xl border border-[var(--border-soft)] bg-[var(--bg-secondary)]/30">
                                        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-bold text-[var(--text-main)] marker:hidden">
                                            <span>
                                                Opciones avanzadas
                                                <span className="ml-2 text-xs font-normal text-[var(--text-muted)]">
                                                    Datos fiscales, envío, notas y firma
                                                </span>
                                            </span>
                                            <ChevronDown className="h-4 w-4 shrink-0 text-[var(--text-muted)] transition-transform group-open:rotate-180" aria-hidden="true" />
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
                                        </div>
                    </details>
                </div>

            )}
        </DocumentFormDialog>
    );
}
