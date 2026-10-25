"use client";

import { useState } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { InvoiceDetailActionBar } from "@/components/invoices/InvoiceDetailActionBar";
import { InvoiceDetailDocument } from "@/components/invoices/InvoiceDetailDocument";
import { InvoiceDetailFiscalPanel } from "@/components/invoices/InvoiceDetailFiscalPanel";
import { DocumentEmailDialog } from "@/components/billing/DocumentEmailDialog";
import { RectificationModal } from "@/components/invoices/RectificationSheet";
import { CustomerPaymentSection } from "@/components/invoices/CustomerPaymentSection";
import { buildDefaultInvoiceEmailMessage } from "@/components/invoices/invoice-detail-utils";
import { useInvoiceDetail } from "@/hooks/useInvoiceDetail";
import { formatInvoiceNumber } from "@/lib/format";
import { Button } from "@/components/ui/button";

type InvoiceDetailViewProps = {
    invoiceId: number;
    initialEdit?: boolean;
    embedded?: boolean;
    onChanged?: () => void;
};

export function InvoiceDetailView({ invoiceId, initialEdit = false, embedded = false, onChanged }: InvoiceDetailViewProps) {
    const [isEmailDialogOpen, setIsEmailDialogOpen] = useState(false);
    const {
        dict, user, userLoading, invoice, client, company, loading, loadError, updatingStatus,
        isRectificationOpen, setIsRectificationOpen, isEditMode, editingItems,
        editingInvoiceNumber, setEditingInvoiceNumber, editingIssueDate, setEditingIssueDate,
        editingDueDate, setEditingDueDate, editingIssuerFields, editingRecipientFields,
        editingPaymentMethod, setEditingPaymentMethod,
        editingPricesIncludeTax, setEditingPricesIncludeTax,
        isSavingDraft, isDownloadingPdf, isSendingEmail, loadAllData, fiscalRecord,
        fiscalReadiness, facturaeReadiness, isSubmittingFiscal, isGeneratingFacturae,
        handleStatusChange, handlePdfAction, handleSendEmail, handleSubmitFiscal,
        handleFacturae, handleDiscardEdit, handleAddEditItem, handleRemoveEditItem,
        handleEditItemChange, handleSaveDraft, handleEditIssuerFieldChange,
        handleEditRecipientFieldChange, editBillingTotals, draftFiscalPreview, formatDate,
        locale, nextStates, issuerName, issuerEmail, issuerLogo, recipientName,
        recipientPostalCode, recipientCity, recipientCountry, recipientEmail, issuerTaxId,
        issuerAddress, recipientTaxId, recipientAddress,
        canManageInvoice, canViewInvoice,
    } = useInvoiceDetail(invoiceId, initialEdit);

    if (userLoading || loading) {
        return <div className="flex min-h-64 flex-col items-center justify-center gap-3 py-20"><Loader2 className="h-8 w-8 animate-spin text-accent" /><span className="text-xs text-[var(--text-muted)]">{dict.dashboard.invoices_details_loading || "Cargando detalles de factura..."}</span></div>;
    }
    if (!user || !canViewInvoice) return null;
    if (!invoice) {
        return <div className="flex flex-col items-center gap-3 p-8 text-center" role="alert">
            <p className="font-semibold text-red-500">
                {loadError === "not_found" ? dict.invoices.not_found : dict.invoices.load_failed}
            </p>
            {loadError === "failed" && <Button type="button" variant="outline" onClick={() => void loadAllData()}>{dict.invoices.retry_load}</Button>}
            {!embedded && <Link href="/dashboard/invoices" className="text-sm text-accent underline">{dict.invoices.back_to_list}</Link>}
        </div>;
    }

    const defaultEmailMessage = buildDefaultInvoiceEmailMessage({ recipientName, issueDate: invoice.issue_date, issuerName, isDraft: invoice.status === "draft", dict, locale });
    const emailDocumentLabel = invoice.status === "draft" ? dict.invoices.email_document_proforma : dict.invoices.email_document_invoice;
    const hasActionButtons = invoice.status === "draft" || isEditMode || (!invoice.is_rectification && ["issued", "partially_paid", "paid", "overdue"].includes(invoice.status)) || ["draft", "issued", "partially_paid", "paid", "overdue", "rectified"].includes(invoice.status) || Boolean(fiscalRecord && !["accepted", "accepted_with_errors"].includes(fiscalRecord.submission_status)) || Boolean(facturaeReadiness?.unsigned_generation_available) || Boolean(facturaeReadiness?.signed_generation_available);
    const noticeCount = [Boolean(draftFiscalPreview), invoice.status !== "draft", Boolean(invoice.invoice_hash)].filter(Boolean).length;
    const formattedInvoiceNumber = formatInvoiceNumber(invoice.invoice_number);
    const refresh = async () => {
        await loadAllData();
        onChanged?.();
    };

    const actionBar = <InvoiceDetailActionBar dict={dict} invoice={invoice} formattedInvoiceNumber={formattedInvoiceNumber} recipientName={recipientName} formatDate={formatDate} nextStates={canManageInvoice ? nextStates : []} actionButtonsVisible={canManageInvoice && hasActionButtons} updatingStatus={updatingStatus} downloadingPdf={isDownloadingPdf} editMode={isEditMode} savingDraft={isSavingDraft} sendingEmail={isSendingEmail} submittingFiscal={isSubmittingFiscal} generatingFacturae={isGeneratingFacturae} fiscalRecord={fiscalRecord} fiscalReadiness={fiscalReadiness} facturaeReadiness={facturaeReadiness} onPdfAction={handlePdfAction} onStatusChange={handleStatusChange} onDiscardEdit={handleDiscardEdit} onSaveDraft={handleSaveDraft} onOpenRectification={() => setIsRectificationOpen(true)} onOpenEmailDialog={() => setIsEmailDialogOpen(true)} onSubmitFiscal={handleSubmitFiscal} onFacturae={handleFacturae} />;
    const documentBody = <><InvoiceDetailFiscalPanel dict={dict} invoice={invoice} noticeCount={noticeCount} draftFiscalPreview={draftFiscalPreview} fiscalRecord={fiscalRecord} fiscalReadiness={fiscalReadiness} facturaeReadiness={facturaeReadiness} onSettingsChanged={refresh} /><InvoiceDetailDocument dict={dict} invoice={invoice} company={company} isEditMode={isEditMode} editingInvoiceNumber={editingInvoiceNumber} editingIssueDate={editingIssueDate} editingDueDate={editingDueDate} editingPaymentMethod={editingPaymentMethod} editingPricesIncludeTax={editingPricesIncludeTax} editingIssuerFields={editingIssuerFields} editingRecipientFields={editingRecipientFields} editingItems={editingItems} editBillingTotals={editBillingTotals} noticeCount={noticeCount} draftFiscalPreview={draftFiscalPreview} fiscalRecord={fiscalRecord} fiscalReadiness={fiscalReadiness} facturaeReadiness={facturaeReadiness} formatDate={formatDate} issuerName={issuerName} issuerTaxId={issuerTaxId} issuerAddress={issuerAddress} issuerEmail={issuerEmail} issuerLogo={issuerLogo} recipientName={recipientName} recipientTaxId={recipientTaxId} recipientAddress={recipientAddress} recipientPostalCode={recipientPostalCode} recipientCity={recipientCity} recipientCountry={recipientCountry} onSettingsChanged={refresh} onEditingInvoiceNumberChange={setEditingInvoiceNumber} onEditingIssueDateChange={setEditingIssueDate} onEditingDueDateChange={setEditingDueDate} onEditingPaymentMethodChange={setEditingPaymentMethod} onEditingPricesIncludeTaxChange={setEditingPricesIncludeTax} onEditIssuerFieldChange={handleEditIssuerFieldChange} onEditRecipientFieldChange={handleEditRecipientFieldChange} onEditItemChange={handleEditItemChange} onRemoveEditItem={handleRemoveEditItem} onAddEditItem={handleAddEditItem} /><CustomerPaymentSection invoice={invoice} canManage={canManageInvoice} onChanged={() => { void loadAllData(); onChanged?.(); }} /></>;
    const dialogs = <><DocumentEmailDialog open={isEmailDialogOpen} onOpenChange={setIsEmailDialogOpen} invoiceNumber={formattedInvoiceNumber} defaultSubject={`${invoice.status === "draft" ? dict.invoices.email_proforma_subject.replace("{number}", formattedInvoiceNumber) : formattedInvoiceNumber} - ${recipientName}`} defaultMessage={defaultEmailMessage} documentLabel={emailDocumentLabel} submitLabel={invoice.status === "draft" ? dict.invoices.send_proforma : dict.invoices.send_email} description={invoice.status === "draft" ? dict.invoices.email_proforma_description.replace("{number}", formattedInvoiceNumber) : dict.invoices.email_invoice_description.replace("{number}", formattedInvoiceNumber)} defaultEmail={recipientEmail} fromName={issuerName} fromEmail={issuerEmail} recipientClient={client} isSending={isSendingEmail} onSend={handleSendEmail} /><RectificationModal open={isRectificationOpen} onOpenChange={setIsRectificationOpen} invoice={invoice} onRectificationCreated={refresh} /></>;

    if (embedded) {
        return <div className="flex min-h-0 flex-1 flex-col overflow-hidden"><div className="flex-none p-3 pb-0 sm:p-4 sm:pb-0">{actionBar}</div><div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden p-3 pt-0 sm:p-4 sm:pt-0">{documentBody}</div>{dialogs}</div>;
    }
    return <div className="dashboard-page-content overflow-x-hidden px-2 py-3 print:overflow-visible print:bg-white print:p-0 print:text-black sm:px-4 lg:px-5">{actionBar}{documentBody}{dialogs}</div>;
}
