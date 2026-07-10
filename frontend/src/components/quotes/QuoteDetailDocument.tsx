"use client";

import Image from "next/image";

import { QuoteDetailHeaderSection } from "@/components/quotes/QuoteDetailHeaderSection";
import { QuoteDetailItemsSection } from "@/components/quotes/QuoteDetailItemsSection";
import { QuoteDetailPartiesSection } from "@/components/quotes/QuoteDetailPartiesSection";
import { QuoteDetailShippingAddress } from "@/components/quotes/QuoteDetailShippingAddress";
import { QuoteDetailTotalsSection } from "@/components/quotes/QuoteDetailTotalsSection";
import type { EditingQuoteItem } from "@/hooks/useQuoteDetail";
import { resolveApiMediaUrl } from "@/lib/api";
import type { Dictionary } from "@/lib/dictionary-context";
import type { Client } from "@/services/client.service";
import type { Company } from "@/services/company.service";
import type { Quote } from "@/types/quote";

export type QuoteDetailDocumentProps = {
    dict: Dictionary;
    quote: Quote;
    client: Client | null;
    company: Company | null;
    isEditMode: boolean;
    editTitle: string;
    onEditTitleChange: (value: string) => void;
    editValidUntil: string;
    onEditValidUntilChange: (value: string) => void;
    editingItems: EditingQuoteItem[];
    editNotes: string;
    onEditNotesChange: (value: string) => void;
    editTerms: string;
    onEditTermsChange: (value: string) => void;
    editDiscount: number;
    onEditDiscountChange: (value: number) => void;
    editTaxRate: number;
    onEditTaxRateChange: (value: number) => void;
    editEquivalenceSurcharge: number;
    onEditEquivalenceSurchargeChange: (value: number) => void;
    editRetention: number;
    onEditRetentionChange: (value: number) => void;
    onAddEditItem: () => void;
    onRemoveEditItem: (index: number) => void;
    onEditItemChange: (index: number, field: keyof EditingQuoteItem, value: string | number) => void;
    editSubtotal: number;
    editBaseAmount: number;
    editTaxAmount: number;
    editTotalAmount: number;
    getClientName: (clientId: number | null) => string;
    getStatusLabel: (status: string) => string;
};

export function QuoteDetailDocument({
    dict,
    quote,
    client,
    company,
    isEditMode,
    editTitle,
    onEditTitleChange,
    editValidUntil,
    onEditValidUntilChange,
    editingItems,
    editNotes,
    onEditNotesChange,
    editTerms,
    onEditTermsChange,
    editDiscount,
    onEditDiscountChange,
    editTaxRate,
    onEditTaxRateChange,
    editEquivalenceSurcharge,
    onEditEquivalenceSurchargeChange,
    editRetention,
    onEditRetentionChange,
    onAddEditItem,
    onRemoveEditItem,
    onEditItemChange,
    editSubtotal,
    editBaseAmount,
    editTaxAmount,
    editTotalAmount,
    getClientName,
    getStatusLabel,
}: QuoteDetailDocumentProps) {
    return (
        <div className="bg-[var(--bg-card)]/90 backdrop-blur-xl border border-[var(--border-soft)] rounded-[32px] p-10 md:p-14 max-w-4xl mx-auto shadow-2xl shadow-accent/[0.04] dark:shadow-[0_0_50px_rgba(0,0,0,0.3)] print:border-none print:shadow-none print:p-0 print:bg-white print:text-black relative overflow-hidden">
            <div className="absolute left-4 right-4 top-3 h-1.5 rounded-full bg-accent print:left-0 print:right-0 print:top-0 print:h-1 print:rounded-none" />

            <QuoteDetailHeaderSection
                dict={dict}
                quote={quote}
                company={company}
                isEditMode={isEditMode}
                editTitle={editTitle}
                onEditTitleChange={onEditTitleChange}
                editValidUntil={editValidUntil}
                onEditValidUntilChange={onEditValidUntilChange}
                getStatusLabel={getStatusLabel}
            />

            <QuoteDetailPartiesSection
                quote={quote}
                client={client}
                company={company}
                getClientName={getClientName}
            />

            <QuoteDetailShippingAddress shippingAddress={quote.shipping_address} />

            <QuoteDetailItemsSection
                dict={dict}
                quote={quote}
                isEditMode={isEditMode}
                editingItems={editingItems}
                editSubtotal={editSubtotal}
                editTotalAmount={editTotalAmount}
                onAddEditItem={onAddEditItem}
                onRemoveEditItem={onRemoveEditItem}
                onEditItemChange={onEditItemChange}
            />

            <QuoteDetailTotalsSection
                quote={quote}
                isEditMode={isEditMode}
                editSubtotal={editSubtotal}
                editBaseAmount={editBaseAmount}
                editTaxAmount={editTaxAmount}
                editTotalAmount={editTotalAmount}
                editDiscount={editDiscount}
                onEditDiscountChange={onEditDiscountChange}
                editTaxRate={editTaxRate}
                onEditTaxRateChange={onEditTaxRateChange}
                editEquivalenceSurcharge={editEquivalenceSurcharge}
                onEditEquivalenceSurchargeChange={onEditEquivalenceSurchargeChange}
                editRetention={editRetention}
                onEditRetentionChange={onEditRetentionChange}
            />

            {isEditMode ? (
                <div className="mt-12 pt-8 border-t border-[var(--border-soft)] border-dashed space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <label htmlFor="quote-edit-notes" className="text-[10px] uppercase font-extrabold tracking-wider text-[var(--text-muted)]">Notas o aclaraciones comerciales</label>
                            <textarea
                                id="quote-edit-notes"
                                value={editNotes}
                                onChange={(e) => onEditNotesChange(e.target.value)}
                                placeholder="Notas comerciales que verá el cliente..."
                                rows={4}
                                className="w-full bg-[var(--bg-primary)] border border-[var(--border-color)] text-[var(--text-main)] rounded-xl px-3 py-2 text-xs outline-none focus:border-accent transition-colors resize-y min-h-[90px] leading-relaxed"
                            />
                        </div>
                        <div className="space-y-2">
                            <label htmlFor="quote-edit-terms" className="text-[10px] uppercase font-extrabold tracking-wider text-[var(--text-muted)]">Términos y condiciones</label>
                            <textarea
                                id="quote-edit-terms"
                                value={editTerms}
                                onChange={(e) => onEditTermsChange(e.target.value)}
                                placeholder="Condiciones de pago, plazos, validez..."
                                rows={4}
                                className="w-full bg-[var(--bg-primary)] border border-[var(--border-color)] text-[var(--text-main)] rounded-xl px-3 py-2 text-xs outline-none focus:border-accent transition-colors resize-y min-h-[90px] leading-relaxed"
                            />
                        </div>
                    </div>
                </div>
            ) : (
                (quote.notes || quote.terms || quote.signature_url || company?.bank_account) && (
                    <div className="mt-12 pt-8 border-t border-[var(--border-soft)] border-dashed print:border-neutral-300 space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {quote.notes && (
                                <div className="space-y-1 text-xs text-[var(--text-muted)] print:text-neutral-600 leading-relaxed">
                                    <p className="font-extrabold text-[var(--text-main)] print:text-black uppercase tracking-wider text-[9px] mb-1">Notas</p>
                                    <p className="whitespace-pre-line">{quote.notes}</p>
                                </div>
                            )}
                            {quote.terms && (
                                <div className="space-y-1 text-xs text-[var(--text-muted)] print:text-neutral-600 leading-relaxed">
                                    <p className="font-extrabold text-[var(--text-main)] print:text-black uppercase tracking-wider text-[9px] mb-1">Términos y condiciones</p>
                                    <p className="whitespace-pre-line">{quote.terms}</p>
                                </div>
                            )}
                        </div>
                        <div className="flex flex-col md:flex-row md:justify-between md:items-end gap-4 pt-4 border-t border-[var(--border-soft)] border-dotted print:border-neutral-200">
                            {company?.bank_account && (
                                <div className="text-[10px] text-[var(--text-muted)] print:text-neutral-600 leading-normal">
                                    <p className="font-semibold text-[var(--text-main)] print:text-black mb-0.5">Información de Pago:</p>
                                    <p>Transferencia bancaria: <span className="font-mono font-semibold text-[var(--text-main)] print:text-black">{company.bank_account}</span></p>
                                </div>
                            )}
                            {quote.signature_url && (
                                <div className="flex flex-col items-center md:items-end shrink-0 ml-auto">
                                    <span className="text-[9px] uppercase tracking-wider font-bold text-[var(--text-muted)] print:text-neutral-500 mb-1">Firma de Conformidad</span>
                                    <Image
                                        src={resolveApiMediaUrl(quote.signature_url) || ""}
                                        alt="Firma"
                                        width={160}
                                        height={64}
                                        className="max-h-16 object-contain border border-[var(--border-soft)] rounded p-1 print:border-neutral-300"
                                        unoptimized
                                    />
                                </div>
                            )}
                        </div>
                    </div>
                )
            )}
        </div>
    );
}
