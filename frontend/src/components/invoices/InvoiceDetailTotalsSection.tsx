import { splitStoredTaxAmount } from "@/lib/billing-calculations";
import type { Dictionary } from "@/lib/dictionary-context";
import { formatCurrency } from "@/lib/format";
import type { Invoice } from "@/types/invoice";

type InvoiceDetailTotalsSectionProps = {
    dict: Dictionary;
    invoice: Invoice;
};

export function InvoiceDetailTotalsSection({ dict, invoice }: InvoiceDetailTotalsSectionProps) {
    const subtotal = invoice.items?.reduce((acc, item) => acc + item.subtotal, 0) || 0;
    const discountAmount = subtotal * ((invoice.discount || 0) / 100.0);
    const { pureVatAmount: taxAmountPure, surchargeAmount } = splitStoredTaxAmount(
        invoice.tax_amount,
        invoice.base_amount,
        invoice.equivalence_surcharge || 0,
    );
    const retentionAmount = invoice.base_amount * ((invoice.retention || 0) / 100.0);

    return (
        <div className="mt-7 flex justify-end pt-5">
            <div className="w-full max-w-72 space-y-1.5 text-[11px]">
                {invoice.discount > 0 && (
                    <>
                        <div className="flex justify-between text-[var(--text-muted)] print:text-black">
                            <span>{dict.invoices.subtotal}:</span>
                            <span className="font-mono">{formatCurrency(subtotal)}</span>
                        </div>
                        <div className="flex justify-between text-[var(--text-muted)] print:text-black">
                            <span>{dict.invoices.global_discount_label} ({invoice.discount}%):</span>
                            <span className="font-mono">-{formatCurrency(discountAmount)}</span>
                        </div>
                    </>
                )}
                <div className="flex justify-between text-[var(--text-muted)] print:text-black font-semibold">
                    <span>{dict.invoices.taxable_base}</span>
                    <span className="font-mono">{formatCurrency(invoice.base_amount)}</span>
                </div>
                <div className="flex justify-between text-[var(--text-muted)] print:text-black">
                    <span>IVA:</span>
                    <span className="font-mono">{formatCurrency(taxAmountPure)}</span>
                </div>
                {invoice.equivalence_surcharge > 0 && (
                    <div className="flex justify-between text-[var(--text-muted)] print:text-black">
                        <span>Recargo Equivalencia ({invoice.equivalence_surcharge}%):</span>
                        <span className="font-mono">{formatCurrency(surchargeAmount)}</span>
                    </div>
                )}
                {invoice.retention > 0 && (
                    <div className="flex justify-between text-[var(--btn-cancel-text)] font-medium">
                        <span>Retención (IRPF -{invoice.retention}%):</span>
                        <span className="font-mono">-{formatCurrency(retentionAmount)}</span>
                    </div>
                )}
                <div className="mt-2 flex justify-between rounded-2xl bg-[color-mix(in_srgb,var(--accent-color)_12%,var(--bg-secondary))] px-4 py-3 text-sm font-semibold text-[var(--text-main)] print:bg-neutral-50 print:text-black">
                    <span>{dict.invoices.total_amount}:</span>
                    <span className="font-mono text-lg">{formatCurrency(invoice.total_amount)}</span>
                </div>
            </div>
        </div>
    );
}
