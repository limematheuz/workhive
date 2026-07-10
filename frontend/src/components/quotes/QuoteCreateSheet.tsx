"use client";

import { useQuoteForm } from "@/hooks/useQuoteForm";
import { Client } from "@/services/client.service";
import { Quote } from "@/types/quote";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Loader2, FileText } from "lucide-react";
import { BillingPartyCard } from "@/components/billing/BillingPartyCard";
import { CompanyLogoUpload } from "@/components/billing/CompanyLogoUpload";
import { SignatureUpload } from "@/components/billing/SignatureUpload";
import { QuoteItemsTable } from "./QuoteItemsTable";
import { QuoteSummary } from "./QuoteSummary";
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
        company,
        title,
        setTitle,
        validUntil,
        setValidUntil,
        companyLogo,
        setCompanyLogo,
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

    return (
        <Dialog open={open} onOpenChange={handleClose}>
            <DialogContent className="sm:max-w-5xl w-full max-h-[95vh] flex flex-col p-0 overflow-hidden rounded-[28px] border-[var(--border-soft)] backdrop-blur-2xl bg-[var(--bg-card)]">
                <form onSubmit={handleCreateQuote} className="flex flex-col flex-1 overflow-hidden">
                    <DialogHeader className="p-6 border-b border-[var(--border-soft)] flex-shrink-0">
                        <DialogTitle className="text-xl font-bold flex items-center gap-2 text-[var(--text-main)]">
                            <FileText className="w-5 h-5 text-[var(--text-main)]" />
                            {quoteToEdit ? (dict.quotes?.edit_title || "Editar Presupuesto") : (dict.quotes?.create_title || "Nuevo Presupuesto")}
                        </DialogTitle>
                        <DialogDescription className="text-sm text-[var(--text-muted)]">
                            {quoteToEdit ? (dict.quotes?.edit_description || "Edita los detalles y conceptos del presupuesto.") : (dict.quotes?.create_description || "Diseña y edita un presupuesto detallado. Rellena los datos a continuación.")}
                        </DialogDescription>
                    </DialogHeader>

                    {/* Scrollable Layout */}
                    <div className="p-6 overflow-y-auto flex-1 grid grid-cols-1 lg:grid-cols-3 gap-6">
                        {loadingClients ? (
                            <div className="lg:col-span-3 flex justify-center py-12 items-center min-h-[250px]">
                                <Loader2 className="w-6 h-6 text-accent animate-spin" />
                            </div>
                        ) : (
                            <>
                                {/* Left Side - Fields & Concepts (Takes 2/3) */}
                                <div className="lg:col-span-2 space-y-6">
                                    {/* Quote Details Grid */}
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                        <div className="md:col-span-2 space-y-3">
                                            <div className="space-y-1">
                                                <Label className="text-xs text-[var(--text-muted)] font-medium">
                                                    {dict.quotes?.title_label || "Título *"}
                                                </Label>
                                                <input
                                                    type="text"
                                                    value={title}
                                                    onChange={(e) => setTitle(e.target.value)}
                                                    required
                                                    placeholder={dict.quotes?.title_placeholder || "Ej: Limpieza de apartamento turístico"}
                                                    className="w-full bg-[var(--bg-primary)] border border-[var(--border-color)] text-[var(--text-main)] rounded-xl px-3 py-2 text-sm outline-none focus:border-accent transition-colors"
                                                />
                                            </div>

                                            <div className="space-y-1">
                                                <Label className="text-xs text-[var(--text-muted)] font-medium">
                                                    {dict.quotes?.valid_until_label || "Válido hasta"}
                                                </Label>
                                                <input
                                                    type="date"
                                                    value={validUntil}
                                                    onChange={(e) => setValidUntil(e.target.value)}
                                                    aria-label={dict.quotes?.valid_until_label || "Válido hasta"}
                                                    className="w-full bg-[var(--bg-primary)] border border-[var(--border-color)] text-[var(--text-main)] rounded-xl px-3 py-2 text-sm outline-none focus:border-accent transition-colors"
                                                />
                                            </div>
                                        </div>

                                        {/* Logo Uploader Block */}
                                        <CompanyLogoUpload
                                            companyId={company?.id}
                                            logoUrl={companyLogo}
                                            onLogoChange={setCompanyLogo}
                                            dict={dict}
                                        />
                                    </div>

                                    {/* Client Selection */}
                                    <div className="space-y-1">
                                        <Label className="text-xs text-[var(--text-muted)] font-medium">
                                            {dict.quotes?.client_label || "Cliente *"}
                                        </Label>
                                        <select
                                            value={selectedClientId}
                                            onChange={(e) => setSelectedClientId(e.target.value)}
                                            aria-label={dict.quotes?.client_label || "Cliente"}
                                            className="w-full bg-[var(--bg-primary)] border border-[var(--border-color)] text-[var(--text-main)] rounded-xl px-3 py-2 text-sm outline-none focus:border-accent transition-colors"
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

                                    {/* Billing Information text boxes */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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

                                    {/* Shipping Address */}
                                    <div className="space-y-1">
                                        <Label className="text-xs text-[var(--text-muted)] font-medium">
                                            {dict.invoices?.shipping_address_label || "Dirección de envío (opcional)"}
                                        </Label>
                                        <textarea
                                            value={shippingAddress}
                                            onChange={(e) => setShippingAddress(e.target.value)}
                                            rows={2}
                                            placeholder={dict.invoices?.shipping_address_placeholder || "Haz click para rellenar dirección de envío si difiere de la dirección fiscal"}
                                            className="w-full bg-[var(--bg-primary)] border border-[var(--border-color)] text-[var(--text-main)] rounded-xl px-3 py-2 text-xs outline-none focus:border-accent transition-colors resize-none"
                                        />
                                    </div>

                                    {/* Concepts Table Section */}
                                    <QuoteItemsTable
                                        concepts={concepts}
                                        dict={dict}
                                        handleAddManualRow={handleAddManualRow}
                                        handleUpdateRow={handleUpdateRow}
                                        handleDeleteRow={handleDeleteRow}
                                    />

                                    {/* Additional toggles: Notes and Terms */}
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

                                {/* Right Side - Task Selection & Summary (Takes 1/3) */}
                                <div className="space-y-6 lg:border-l lg:border-[var(--border-soft)] lg:pl-6">
                                    <QuoteSummary
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

                                    {/* Signature Block */}
                                    <SignatureUpload
                                        signatureUrl={signatureUrl}
                                        onSignatureChange={setSignatureUrl}
                                        dict={dict}
                                    />
                                </div>
                            </>
                        )}
                    </div>

                    {/* Bottom Actions footer */}
                    <div className="p-6 pt-4 flex gap-3 border-t border-[var(--border-soft)] bg-[var(--bg-card)] flex-shrink-0">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={handleClose}
                            className="w-1/2 bg-[var(--btn-cancel-bg)] text-[var(--btn-cancel-text)] border border-[var(--btn-cancel-border)] hover:bg-[var(--btn-cancel-hover-bg)] hover:text-[var(--btn-cancel-hover-text)] hover:border-transparent text-xs font-semibold rounded-xl px-5 py-2.5 cursor-pointer transition-all"
                        >
                            {dict.clients?.form?.cancel || "Cancelar"}
                        </Button>
                        <Button
                            type="submit"
                            disabled={submitting || concepts.length === 0}
                            className="w-1/2 bg-[var(--btn-primary-bg)] text-[var(--btn-primary-text)] hover:bg-[var(--btn-primary-hover-bg)] text-xs font-semibold rounded-xl px-5 py-2.5 border border-[var(--border-soft)] flex items-center justify-center gap-1.5 cursor-pointer transition-all"
                        >
                            {submitting ? (
                                <>
                                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                                    {quoteToEdit ? (dict.quotes?.saving || "Guardando...") : (dict.quotes?.saving || "Generando...")}
                                </>
                            ) : (
                                quoteToEdit ? (dict.quotes?.save_changes || "Guardar Cambios") : (dict.quotes?.save || "Crear Presupuesto")
                            )}
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}
