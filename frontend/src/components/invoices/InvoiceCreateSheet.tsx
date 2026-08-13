"use client";

import { useInvoiceForm } from "@/hooks/useInvoiceForm";
import { DocumentFormDialog } from "@/components/billing/DocumentFormDialog";
import { Loader2, Receipt } from "lucide-react";
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
        paymentMethod,
        setPaymentMethod,
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
        handleDuplicateRow,
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

    const details = loadingClients ? (
        <div className="flex min-h-[250px] items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-accent" />
        </div>
    ) : (
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
            paymentMethod={paymentMethod}
            setPaymentMethod={setPaymentMethod}
            maxDueDate={maxDueDate}
            shippingAddress={shippingAddress}
            setShippingAddress={setShippingAddress}
            concepts={concepts}
            handleAddManualRow={handleAddManualRow}
            handleDuplicateRow={handleDuplicateRow}
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
    );

    const sidebar = (
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
    );

    return (
        <DocumentFormDialog
            open={open}
            onOpenChange={onOpenChange}
            onSubmit={handleCreateInvoice}
            icon={<Receipt className="h-5 w-5" />}
            title={dict.invoices?.new_invoice || "Nueva factura"}
            description={dict.invoices?.create_description || "Añade conceptos manuales o incorpora trabajos ya terminados del cliente."}
            cancelLabel={dict.clients?.form?.cancel || "Cancelar"}
            submitLabel={dict.invoices?.generate_invoice_btn || "Generar factura"}
            submittingLabel={dict.invoices?.generating_btn || "Generando..."}
            submitting={submitting}
            submitDisabled={concepts.length === 0 || loadingClients}
            onCancel={() => onOpenChange(false)}
            sidebar={sidebar}
        >
            {details}
        </DocumentFormDialog>
    );
}
