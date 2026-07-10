import { Plus, Trash2 } from "lucide-react";

import { TaxRateSelect } from "@/components/billing/BillingSelectors";
import type { EditBillingTotals } from "@/components/invoices/invoice-detail-document-types";
import type { EditingInvoiceItem } from "@/hooks/useInvoiceDetail";
import type { Dictionary } from "@/lib/dictionary-context";
import { formatCurrency } from "@/lib/format";
import type { Invoice } from "@/types/invoice";

type InvoiceDetailItemsSectionProps = {
    dict: Dictionary;
    invoice: Invoice;
    isEditMode: boolean;
    editingItems: EditingInvoiceItem[];
    editBillingTotals: EditBillingTotals;
    onEditItemChange: (index: number, field: keyof EditingInvoiceItem, value: string | number) => void;
    onRemoveEditItem: (index: number) => void;
    onAddEditItem: () => void;
};

export function InvoiceDetailItemsSection({
    dict,
    invoice,
    isEditMode,
    editingItems,
    editBillingTotals,
    onEditItemChange,
    onRemoveEditItem,
    onAddEditItem,
}: InvoiceDetailItemsSectionProps) {
    return (
        <div className="mt-5">
            {isEditMode ? (
                <div className="space-y-2 overflow-x-auto">
                    <div className="grid min-w-[720px] grid-cols-[1fr_60px_90px_60px_80px_36px] gap-2 border-b border-[var(--border-soft)] pb-1 text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                        <span className="px-1">{dict.invoices.concept}</span>
                        <span className="text-center">{dict.invoices.quantity}</span>
                        <span className="text-right">{dict.invoices.price}</span>
                        <span className="text-center">{dict.invoices.tax}</span>
                        <span className="text-right">{dict.invoices.subtotal}</span>
                        <span />
                    </div>

                    {editingItems.map((item, index) => {
                        const lineSubtotal = item.quantity * item.unit_price;
                        return (
                            <div
                                key={item.clientKey}
                                className="grid min-w-[720px] grid-cols-[1fr_60px_90px_60px_80px_36px] items-center gap-2 py-1"
                            >
                                <input
                                    type="text"
                                    value={item.description}
                                    onChange={(e) => onEditItemChange(index, "description", e.target.value)}
                                    placeholder={dict.invoices.line_description_placeholder}
                                    className="w-full bg-[var(--bg-primary)] border border-[var(--border-color)] text-[var(--text-main)] rounded-lg px-2 py-1.5 text-xs outline-none focus:border-accent transition-colors"
                                />
                                <input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    aria-label={dict.invoices.col_qty}
                                    value={item.quantity}
                                    onChange={(e) => onEditItemChange(index, "quantity", parseFloat(e.target.value) || 0)}
                                    className="w-full bg-[var(--bg-primary)] border border-[var(--border-color)] text-[var(--text-main)] rounded-lg px-2 py-1.5 text-xs text-center outline-none focus:border-accent transition-colors font-mono"
                                />
                                <input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    aria-label={dict.invoices.price}
                                    value={item.unit_price}
                                    onChange={(e) => onEditItemChange(index, "unit_price", parseFloat(e.target.value) || 0)}
                                    className="w-full bg-[var(--bg-primary)] border border-[var(--border-color)] text-[var(--text-main)] rounded-lg px-2 py-1.5 text-xs text-right outline-none focus:border-accent transition-colors font-mono"
                                />
                                <TaxRateSelect
                                    value={item.tax_rate}
                                    onChange={(rate) => onEditItemChange(index, "tax_rate", rate)}
                                    className="w-full bg-[var(--bg-primary)] border border-[var(--border-color)] text-[var(--text-main)] rounded-lg px-1 py-1.5 text-xs text-center outline-none focus:border-accent transition-colors cursor-pointer"
                                />
                                <span className="text-xs text-right font-semibold text-[var(--text-main)] font-mono">
                                    {formatCurrency(lineSubtotal)}
                                </span>
                                <button
                                    type="button"
                                    aria-label="Eliminar línea"
                                    onClick={() => onRemoveEditItem(index)}
                                    className="w-8 h-8 flex items-center justify-center rounded-lg border border-[var(--border-soft)] text-[var(--text-muted)] hover:text-[var(--text-main)] hover:border-[var(--border-color)] transition-all cursor-pointer bg-transparent"
                                >
                                    <Trash2 className="w-3.5 h-3.5" />
                                </button>
                            </div>
                        );
                    })}

                    <button
                        type="button"
                        onClick={onAddEditItem}
                        className="w-full mt-2 flex items-center justify-center gap-2 py-2.5 text-xs font-semibold text-[var(--text-muted)] hover:text-[var(--text-main)] border border-dashed border-[var(--border-color)] rounded-xl hover:border-[var(--border-soft)] hover:bg-[var(--bg-secondary)] transition-all cursor-pointer bg-transparent"
                    >
                        <Plus className="w-3.5 h-3.5" />
                        {dict.invoices.add_concept}
                    </button>

                    <div className="mt-6 border-t border-[var(--border-soft)] pt-4 flex justify-end">
                        <div className="w-64 space-y-1.5 text-xs">
                            {editBillingTotals && editBillingTotals.discountAmount > 0 && (
                                <div className="flex justify-between text-[var(--text-muted)]">
                                    <span>{dict.invoices.discount} ({invoice.discount}%):</span>
                                    <span className="font-mono">-{formatCurrency(editBillingTotals.discountAmount)}</span>
                                </div>
                            )}
                            <div className="flex justify-between text-[var(--text-muted)]">
                                <span>{dict.invoices.taxable_base}</span>
                                <span className="font-mono">{formatCurrency(editBillingTotals?.baseAmount ?? 0)}</span>
                            </div>
                            <div className="flex justify-between text-[var(--text-muted)]">
                                <span>{dict.invoices.estimated_vat}:</span>
                                <span className="font-mono">{formatCurrency(editBillingTotals?.taxAmount ?? 0)}</span>
                            </div>
                            {(invoice.equivalence_surcharge || 0) > 0 && (
                                <div className="flex justify-between text-[var(--text-muted)]">
                                    <span>{dict.invoices.equivalence_surcharge}:</span>
                                    <span className="font-mono">{formatCurrency(editBillingTotals?.surchargeAmount ?? 0)}</span>
                                </div>
                            )}
                            {(invoice.retention || 0) > 0 && (
                                <div className="flex justify-between text-[var(--btn-cancel-text)]">
                                    <span>{dict.invoices.retention_irpf}:</span>
                                    <span className="font-mono">-{formatCurrency(editBillingTotals?.retentionAmount ?? 0)}</span>
                                </div>
                            )}
                            <div className="flex justify-between text-base font-bold text-[var(--text-main)] border border-[var(--border-soft)] pt-3 pb-3 px-4 rounded-2xl bg-[var(--bg-secondary)]">
                                <span className="font-extrabold">{dict.invoices.total_amount}:</span>
                                <span className="font-mono font-black text-xl">{formatCurrency(editBillingTotals?.totalAmount ?? 0)}</span>
                            </div>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="-mx-2 overflow-x-auto px-2">
                    <table className="min-w-[620px] w-full table-fixed border-collapse text-left text-[11px]">
                        <thead>
                            <tr className="border-b border-[var(--border-soft)] bg-[var(--bg-secondary)] text-[9px] font-black uppercase tracking-wider text-[var(--text-muted)] print:border-neutral-300 print:bg-neutral-100 print:text-neutral-600">
                                <th className="rounded-l-xl px-3 py-2">{dict.invoices.concept}</th>
                                <th className="w-14 px-2 py-2 text-center">{dict.invoices.quantity}</th>
                                <th className="w-24 px-2 py-2 text-right">{dict.invoices.price}</th>
                                <th className="w-14 px-2 py-2 text-center">{dict.invoices.tax}</th>
                                <th className="w-28 rounded-r-xl px-3 py-2 text-right">{dict.invoices.subtotal}</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-[var(--border-soft)]/30 print:divide-neutral-200">
                            {invoice.items && invoice.items.length > 0 ? (
                                invoice.items.map((item, idx) => (
                                    <tr
                                        key={item.id}
                                        className={`transition-colors hover:bg-[var(--bg-tertiary)] print:text-black ${
                                            idx % 2 === 0 ? "bg-transparent" : "bg-[var(--bg-secondary)]/35 print:bg-neutral-50"
                                        }`}
                                    >
                                        <td className="px-3 py-2.5 font-semibold leading-5 text-[var(--text-main)] print:text-black">
                                            {item.description}
                                        </td>
                                        <td className="px-2 py-2.5 text-center font-mono font-semibold text-[var(--text-muted)] print:text-black">
                                            {item.quantity}
                                        </td>
                                        <td className="px-2 py-2.5 text-right font-mono text-[var(--text-muted)] print:text-black">
                                            {formatCurrency(item.unit_price)}
                                        </td>
                                        <td className="px-2 py-2.5 text-center font-mono text-[var(--text-muted)] print:text-black">
                                            {(item.tax_rate * 100).toFixed(0)}%
                                        </td>
                                        <td className="px-3 py-2.5 text-right font-mono font-black text-[var(--text-main)] print:text-black">
                                            {formatCurrency(item.subtotal)}
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={5} className="py-8 text-center text-[var(--text-muted)] print:text-black font-medium">
                                        {dict.invoices.empty_invoice_lines}
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
