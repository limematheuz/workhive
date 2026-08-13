"use client";

import { InvoiceDetailEditModePanel } from "@/components/invoices/InvoiceDetailEditModePanel";
import { InvoiceDetailFooterSection } from "@/components/invoices/InvoiceDetailFooterSection";
import { InvoiceDetailHeaderSection } from "@/components/invoices/InvoiceDetailHeaderSection";
import { InvoiceDetailItemsSection } from "@/components/invoices/InvoiceDetailItemsSection";
import { InvoiceDetailRectificationBanner } from "@/components/invoices/InvoiceDetailRectificationBanner";
import { InvoiceDetailShippingAddress } from "@/components/invoices/InvoiceDetailShippingAddress";
import { InvoiceDetailSummaryAside } from "@/components/invoices/InvoiceDetailSummaryAside";
import { InvoiceDetailTotalsSection } from "@/components/invoices/InvoiceDetailTotalsSection";
import type { InvoiceDetailDocumentProps } from "@/components/invoices/invoice-detail-document-types";

export type { InvoiceDetailDocumentProps } from "@/components/invoices/invoice-detail-document-types";

export function InvoiceDetailDocument({
    dict,
    invoice,
    company,
    isEditMode,
    editingInvoiceNumber,
    editingIssueDate,
    editingDueDate,
    editingPaymentMethod,
    editingIssuerFields,
    editingRecipientFields,
    editingItems,
    editBillingTotals,
    noticeCount,
    draftFiscalPreview,
    fiscalRecord,
    fiscalReadiness,
    facturaeReadiness,
    formatDate,
    issuerName,
    issuerTaxId,
    issuerAddress,
    issuerEmail,
    issuerLogo,
    recipientName,
    recipientTaxId,
    recipientAddress,
    recipientPostalCode,
    recipientCity,
    recipientCountry,
    onSettingsChanged,
    onEditingInvoiceNumberChange,
    onEditingIssueDateChange,
    onEditingDueDateChange,
    onEditingPaymentMethodChange,
    onEditIssuerFieldChange,
    onEditRecipientFieldChange,
    onEditItemChange,
    onRemoveEditItem,
    onAddEditItem,
}: InvoiceDetailDocumentProps) {
    return (
        <>
            {isEditMode && invoice.status === "draft" && (
                <InvoiceDetailEditModePanel
                    dict={dict}
                    editingInvoiceNumber={editingInvoiceNumber}
                    editingIssueDate={editingIssueDate}
                    editingDueDate={editingDueDate}
                    editingPaymentMethod={editingPaymentMethod}
                    editingIssuerFields={editingIssuerFields}
                    editingRecipientFields={editingRecipientFields}
                    onEditingInvoiceNumberChange={onEditingInvoiceNumberChange}
                    onEditingIssueDateChange={onEditingIssueDateChange}
                    onEditingDueDateChange={onEditingDueDateChange}
                    onEditingPaymentMethodChange={onEditingPaymentMethodChange}
                    onEditIssuerFieldChange={onEditIssuerFieldChange}
                    onEditRecipientFieldChange={onEditRecipientFieldChange}
                />
            )}

            <div className="relative isolate mx-auto w-full max-w-[112rem]">
                <div className="invoice-detail-backlight print:hidden" aria-hidden="true" />
                <div className="relative z-10 grid gap-4 print:block xl:grid-cols-[minmax(0,1fr)_18rem] xl:items-start 2xl:grid-cols-[minmax(0,1fr)_20rem]">
                    <div className="billing-surface relative min-w-0 overflow-hidden rounded-[24px] p-4 print:border-none print:bg-white print:p-0 print:text-black print:shadow-none sm:p-5 lg:p-6">
                        <div className="absolute left-4 right-4 top-3 h-1.5 rounded-full bg-accent print:left-0 print:right-0 print:top-0 print:h-1 print:rounded-none" />

                        <InvoiceDetailHeaderSection
                            dict={dict}
                            invoice={invoice}
                            formatDate={formatDate}
                            issuerName={issuerName}
                            issuerTaxId={issuerTaxId}
                            issuerAddress={issuerAddress}
                            issuerEmail={issuerEmail}
                            issuerLogo={issuerLogo}
                            recipientName={recipientName}
                            recipientTaxId={recipientTaxId}
                            recipientAddress={recipientAddress}
                            recipientPostalCode={recipientPostalCode}
                            recipientCity={recipientCity}
                            recipientCountry={recipientCountry}
                        />

                        <InvoiceDetailShippingAddress
                            dict={dict}
                            shippingAddress={invoice.shipping_address}
                        />

                        <InvoiceDetailRectificationBanner dict={dict} invoice={invoice} />

                        <InvoiceDetailItemsSection
                            dict={dict}
                            invoice={invoice}
                            isEditMode={isEditMode}
                            editingItems={editingItems}
                            editBillingTotals={editBillingTotals}
                            onEditItemChange={onEditItemChange}
                            onRemoveEditItem={onRemoveEditItem}
                            onAddEditItem={onAddEditItem}
                        />

                        {!isEditMode && (
                            <InvoiceDetailTotalsSection dict={dict} invoice={invoice} />
                        )}

                        <InvoiceDetailFooterSection
                            dict={dict}
                            invoice={invoice}
                            company={company}
                        />
                    </div>

                    <InvoiceDetailSummaryAside
                        dict={dict}
                        invoice={invoice}
                        noticeCount={noticeCount}
                        draftFiscalPreview={draftFiscalPreview}
                        fiscalRecord={fiscalRecord}
                        fiscalReadiness={fiscalReadiness}
                        facturaeReadiness={facturaeReadiness}
                        onSettingsChanged={onSettingsChanged}
                    />
                </div>
            </div>
        </>
    );
}
