"use client";

import { useInvoiceForm } from "@/hooks/useInvoiceForm";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { InvoiceCreateSheetDetails } from "./InvoiceCreateSheetDetails";
import { InvoiceCreateSheetSidebar } from "./InvoiceCreateSheetSidebar";
import type { InvoiceableTask } from "@/services/invoice.service";

const EMPTY_TASK_IDS: number[] = [];
const EMPTY_TASKS: InvoiceableTask[] = [];

interface InvoiceCreateSheetProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onInvoiceCreated: () => void;
    initialClientId?: string;
    initialTaskIds?: number[];
    initialTasks?: InvoiceableTask[];
}

export function InvoiceCreateSheet({
    open,
    onOpenChange,
    onInvoiceCreated,
    initialClientId,
    initialTaskIds = EMPTY_TASK_IDS,
    initialTasks = EMPTY_TASKS,
}: InvoiceCreateSheetProps) {
    const {
        dict,
        clients,
        selectedClientId,
        setSelectedClientId,
        isClientLocked,
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
        loadingTasks,
        submitting,
        availableTasks,
        selectedTaskIds,
        handleToggleTask,
        handleToggleAll,
        handleAddManualRow,
        handleAddExternalLaundryRow,
        handleUpdateRow,
        handleDeleteRow,
        handleGlobalTaxRateChange,
        subtotal,
        baseAmount,
        taxAmount,
        surchargeAmount,
        retentionAmount,
        totalGeneral,
        handleCreateInvoice,
        handleUpdateIssuerField,
        handleUpdateRecipientField,
        issuerFields,
        recipientFields,
        isEditingIssuer,
        setIsEditingIssuer,
        isEditingRecipient,
        setIsEditingRecipient,
    } = useInvoiceForm({
        open,
        onOpenChange,
        onInvoiceCreated,
        initialClientId,
        initialTaskIds,
        initialTasks,
    });

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-5xl w-full max-h-[95vh] flex flex-col p-0 overflow-hidden rounded-[28px] border-[var(--border-soft)]">
                <form onSubmit={handleCreateInvoice} className="flex flex-col flex-1 overflow-hidden">
                    <DialogHeader className="p-6 border-b border-[var(--border-soft)] flex-shrink-0">
                        <DialogTitle className="text-xl font-bold flex items-center gap-2 text-[var(--text-main)]">
                            {dict.invoices?.new_invoice}
                        </DialogTitle>
                        <DialogDescription className="text-sm text-[var(--text-muted)]">
                            {dict.invoices?.create_description || "Diseña y edita una factura detallada. Puedes añadir conceptos manuales o cargar trabajos completados del cliente."}
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
                                <InvoiceCreateSheetDetails
                                    dict={dict}
                                    clients={clients}
                                    selectedClientId={selectedClientId}
                                    setSelectedClientId={setSelectedClientId}
                                    isClientLocked={isClientLocked}
                                    initialTasks={initialTasks}
                                    issueDate={issueDate}
                                    setIssueDate={setIssueDate}
                                    dueDate={dueDate}
                                    setDueDate={setDueDate}
                                    invoiceNumber={invoiceNumber}
                                    setInvoiceNumber={setInvoiceNumber}
                                    maxDueDate={maxDueDate}
                                    shippingAddress={shippingAddress}
                                    setShippingAddress={setShippingAddress}
                                    concepts={concepts}
                                    handleAddManualRow={handleAddManualRow}
                                    handleAddExternalLaundryRow={handleAddExternalLaundryRow}
                                    handleUpdateRow={handleUpdateRow}
                                    handleDeleteRow={handleDeleteRow}
                                    notesEnabled={notesEnabled}
                                    setNotesEnabled={setNotesEnabled}
                                    notes={notes}
                                    setNotes={setNotes}
                                    termsEnabled={termsEnabled}
                                    setTermsEnabled={setTermsEnabled}
                                    terms={terms}
                                    setTerms={setTerms}
                                    issuerFields={issuerFields}
                                    recipientFields={recipientFields}
                                    isEditingIssuer={isEditingIssuer}
                                    setIsEditingIssuer={setIsEditingIssuer}
                                    isEditingRecipient={isEditingRecipient}
                                    setIsEditingRecipient={setIsEditingRecipient}
                                    handleUpdateIssuerField={handleUpdateIssuerField}
                                    handleUpdateRecipientField={handleUpdateRecipientField}
                                />

                                <InvoiceCreateSheetSidebar
                                    dict={dict}
                                    availableTasks={availableTasks}
                                    selectedTaskIds={selectedTaskIds}
                                    loadingTasks={loadingTasks}
                                    handleToggleAll={handleToggleAll}
                                    handleToggleTask={handleToggleTask}
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
                                    signatureUrl={signatureUrl}
                                    setSignatureUrl={setSignatureUrl}
                                />
                            </>
                        )}
                    </div>

                    {/* Bottom Actions footer */}
                    <div className="dialog-glass-chrome p-6 pt-4 flex gap-3 border-t border-[var(--border-soft)] flex-shrink-0">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => onOpenChange(false)}
                            className="w-1/2 bg-[var(--btn-cancel-bg)] text-[var(--btn-cancel-text)] border border-[var(--btn-cancel-border)] hover:bg-[var(--btn-cancel-hover-bg)] hover:text-[var(--btn-cancel-hover-text)] hover:border-transparent text-xs font-semibold rounded-xl px-5 py-2.5 cursor-pointer ui-motion"
                        >
                            {dict.clients?.form?.cancel || "Cancelar"}
                        </Button>
                        <Button
                            type="submit"
                            disabled={submitting || concepts.length === 0 || loadingClients}
                            className="w-1/2 bg-[var(--btn-primary-bg)] text-[var(--btn-primary-text)] hover:bg-[var(--btn-primary-hover-bg)] text-xs font-semibold rounded-xl px-5 py-2.5 border border-[var(--border-soft)] flex items-center justify-center gap-1.5 cursor-pointer ui-motion"
                        >
                            {submitting ? (
                                <>
                                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                                    {dict.invoices?.generating_btn || "Generando..."}
                                </>
                            ) : (
                                dict.invoices?.generate_invoice_btn || "Generar Factura"
                            )}
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}
