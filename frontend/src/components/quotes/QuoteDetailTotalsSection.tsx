import { TaxRateSelect } from "@/components/billing/BillingSelectors";
import { splitStoredTaxAmount } from "@/lib/billing-calculations";
import { formatCurrency } from "@/lib/format";
import type { Quote } from "@/types/quote";

type QuoteDetailTotalsSectionProps = {
    quote: Quote;
    isEditMode: boolean;
    editSubtotal: number;
    editBaseAmount: number;
    editTaxAmount: number;
    editTotalAmount: number;
    editDiscount: number;
    onEditDiscountChange: (value: number) => void;
    editTaxRate: number;
    onEditTaxRateChange: (value: number) => void;
    editEquivalenceSurcharge: number;
    onEditEquivalenceSurchargeChange: (value: number) => void;
    editRetention: number;
    onEditRetentionChange: (value: number) => void;
};

export function QuoteDetailTotalsSection({
    quote,
    isEditMode,
    editSubtotal,
    editBaseAmount,
    editTaxAmount,
    editTotalAmount,
    editDiscount,
    onEditDiscountChange,
    editTaxRate,
    onEditTaxRateChange,
    editEquivalenceSurcharge,
    onEditEquivalenceSurchargeChange,
    editRetention,
    onEditRetentionChange,
}: QuoteDetailTotalsSectionProps) {
    const subtotal = quote.items?.reduce((acc, item) => acc + item.subtotal, 0) || 0;
    const discountAmount = subtotal * ((quote.discount || 0) / 100.0);
    const { pureVatAmount: taxAmountPure, surchargeAmount } = splitStoredTaxAmount(
        quote.tax_amount,
        quote.base_amount,
        quote.equivalence_surcharge || 0,
    );
    const retentionAmount = quote.base_amount * ((quote.retention || 0) / 100.0);

    return (
        <div className="mt-10 border-t border-[var(--border-soft)] pt-6 flex justify-end print:border-neutral-300">
            <div className="w-80 space-y-2 text-xs">
                {isEditMode ? (
                    <div className="space-y-2.5">
                        <div className="flex justify-between text-[var(--text-muted)]">
                            <span>Subtotal (Suma de líneas):</span>
                            <span className="font-mono">{formatCurrency(editSubtotal)}</span>
                        </div>

                        <div className="flex items-center justify-between text-[var(--text-muted)]">
                            <span>Descuento (%):</span>
                            <input
                                type="number"
                                min="0"
                                max="100"
                                aria-label="Descuento (%)"
                                value={editDiscount}
                                onChange={(e) => onEditDiscountChange(parseFloat(e.target.value) || 0)}
                                className="bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg px-2 py-0.5 text-xs text-right w-20 h-7 font-mono"
                            />
                        </div>

                        <div className="flex justify-between text-[var(--text-muted)]">
                            <span>Base imponible:</span>
                            <span className="font-mono">{formatCurrency(editBaseAmount)}</span>
                        </div>

                        <div className="flex justify-between text-[var(--text-muted)]">
                            <span>IVA ({Math.round(editTaxRate * 100)}%):</span>
                            <span className="font-mono">{formatCurrency(editTaxAmount)}</span>
                        </div>

                        <div className="flex items-center justify-between text-[var(--text-muted)]">
                            <span>Tipo de IVA:</span>
                            <TaxRateSelect
                                value={editTaxRate}
                                onChange={onEditTaxRateChange}
                                className="bg-[var(--bg-primary)] border border-[var(--border-color)] text-[var(--text-main)] rounded-lg px-2 py-0.5 text-xs outline-none h-7 cursor-pointer"
                            />
                        </div>

                        <div className="flex items-center justify-between text-[var(--text-muted)]">
                            <span>Recargo Equivalencia (%):</span>
                            <input
                                type="number"
                                min="0"
                                max="100"
                                step="0.01"
                                aria-label="Recargo Equivalencia (%)"
                                value={editEquivalenceSurcharge}
                                onChange={(e) => onEditEquivalenceSurchargeChange(parseFloat(e.target.value) || 0)}
                                className="bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg px-2 py-0.5 text-xs text-right w-20 h-7 font-mono"
                            />
                        </div>

                        <div className="flex items-center justify-between text-[var(--text-muted)]">
                            <span>Retención (IRPF %):</span>
                            <input
                                type="number"
                                min="0"
                                max="100"
                                step="0.01"
                                aria-label="Retención (IRPF %)"
                                value={editRetention}
                                onChange={(e) => onEditRetentionChange(parseFloat(e.target.value) || 0)}
                                className="bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg px-2 py-0.5 text-xs text-right w-20 h-7 font-mono text-rose-500"
                            />
                        </div>

                        <div className="flex justify-between text-base font-black text-[var(--text-main)] border-t border-[var(--border-soft)] pt-2.5">
                            <span>TOTAL:</span>
                            <span className="text-accent font-mono text-lg">{formatCurrency(editTotalAmount)}</span>
                        </div>
                    </div>
                ) : (
                    <>
                        {quote.discount > 0 && (
                            <>
                                <div className="flex justify-between text-[var(--text-muted)] print:text-black">
                                    <span>Subtotal:</span>
                                    <span className="font-mono">{formatCurrency(subtotal)}</span>
                                </div>
                                <div className="flex justify-between text-[var(--text-muted)] print:text-black">
                                    <span>Descuento Global ({quote.discount}%):</span>
                                    <span className="font-mono">-{formatCurrency(discountAmount)}</span>
                                </div>
                            </>
                        )}
                        <div className="flex justify-between text-[var(--text-muted)] print:text-black font-semibold">
                            <span>Base Imponible:</span>
                            <span className="font-mono">{formatCurrency(quote.base_amount)}</span>
                        </div>
                        <div className="flex justify-between text-[var(--text-muted)] print:text-black">
                            <span>IVA ({Math.round((quote.tax_rate ?? 0.21) * 100)}%):</span>
                            <span className="font-mono">{formatCurrency(taxAmountPure)}</span>
                        </div>
                        {quote.equivalence_surcharge > 0 && (
                            <div className="flex justify-between text-[var(--text-muted)] print:text-black">
                                <span>Recargo Equivalencia ({quote.equivalence_surcharge}%):</span>
                                <span className="font-mono">{formatCurrency(surchargeAmount)}</span>
                            </div>
                        )}
                        {quote.retention > 0 && (
                            <div className="flex justify-between text-rose-500 font-medium">
                                <span>Retención (IRPF -{quote.retention}%):</span>
                                <span className="font-mono">-{formatCurrency(retentionAmount)}</span>
                            </div>
                        )}
                        <div className="flex justify-between text-base font-bold text-[var(--text-main)] border border-accent/20 pt-3 pb-3 px-4 rounded-2xl bg-accent/5 dark:bg-accent/10 print:text-black print:border-neutral-300 print:bg-neutral-50">
                            <span className="text-accent dark:text-accent font-extrabold print:text-black">TOTAL:</span>
                            <span className="text-accent dark:text-accent font-mono font-black text-xl print:text-black">{formatCurrency(quote.total_amount)}</span>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
