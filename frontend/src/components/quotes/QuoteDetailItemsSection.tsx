import { Plus, Trash2 } from "lucide-react";

import type { EditingQuoteItem } from "@/hooks/useQuoteDetail";
import type { Dictionary } from "@/lib/dictionary-context";
import { formatCurrency } from "@/lib/format";
import type { Quote } from "@/types/quote";

type QuoteDetailItemsSectionProps = {
    dict: Dictionary;
    quote: Quote;
    isEditMode: boolean;
    editingItems: EditingQuoteItem[];
    editSubtotal: number;
    editTotalAmount: number;
    onAddEditItem: () => void;
    onRemoveEditItem: (index: number) => void;
    onEditItemChange: (index: number, field: keyof EditingQuoteItem, value: string | number) => void;
};

export function QuoteDetailItemsSection({
    dict,
    quote,
    isEditMode,
    editingItems,
    editSubtotal,
    editTotalAmount,
    onAddEditItem,
    onRemoveEditItem,
    onEditItemChange,
}: QuoteDetailItemsSectionProps) {
    return (
        <div className="mt-10">
            {isEditMode ? (
                <div className="space-y-3">
                    <div className="grid grid-cols-[1fr_75px_100px_100px_36px] gap-3 text-[10px] uppercase font-extrabold tracking-wider text-[var(--text-muted)] pb-2 border-b border-[var(--border-soft)] px-2">
                        <span>Concepto</span>
                        <span className="text-center">Cant.</span>
                        <span className="text-right">Precio</span>
                        <span className="text-right">Subtotal</span>
                        <span />
                    </div>

                    <div className="space-y-2">
                        {editingItems.map((item, index) => {
                            const lineSubtotal = item.quantity * item.unit_price;
                            return (
                                <div
                                    key={item.clientKey}
                                    className="grid grid-cols-[1fr_75px_100px_100px_36px] gap-3 items-start py-2 hover:bg-[var(--bg-primary)]/10 px-2 rounded-xl transition-all"
                                >
                                    <textarea
                                        value={item.description}
                                        onChange={(e) => onEditItemChange(index, "description", e.target.value)}
                                        placeholder="Descripción detallada de la línea..."
                                        rows={2}
                                        className="w-full bg-[var(--bg-primary)] border border-[var(--border-color)] text-[var(--text-main)] rounded-lg px-2.5 py-1.5 text-xs outline-none focus:border-accent transition-colors resize-y leading-tight"
                                    />
                                    <input
                                        type="number"
                                        min="0.01"
                                        step="0.01"
                                        aria-label="Cantidad"
                                        value={item.quantity}
                                        onChange={(e) => onEditItemChange(index, "quantity", parseFloat(e.target.value) || 0)}
                                        className="w-full bg-[var(--bg-primary)] border border-[var(--border-color)] text-[var(--text-main)] rounded-lg px-2 py-1.5 text-xs text-center outline-none focus:border-accent transition-colors font-mono"
                                    />
                                    <input
                                        type="number"
                                        min="0"
                                        step="0.01"
                                        aria-label="Precio"
                                        value={item.unit_price}
                                        onChange={(e) => onEditItemChange(index, "unit_price", parseFloat(e.target.value) || 0)}
                                        className="w-full bg-[var(--bg-primary)] border border-[var(--border-color)] text-[var(--text-main)] rounded-lg px-2 py-1.5 text-xs text-right outline-none focus:border-accent transition-colors font-mono"
                                    />
                                    <span className="text-xs text-right font-bold text-[var(--text-main)] font-mono pt-2">
                                        {formatCurrency(lineSubtotal)}
                                    </span>
                                    <button
                                        type="button"
                                        aria-label="Eliminar línea"
                                        onClick={() => onRemoveEditItem(index)}
                                        className="w-8 h-8 flex items-center justify-center rounded-lg border border-[var(--border-soft)] text-[var(--text-muted)] hover:text-[var(--btn-cancel-text)] hover:border-[var(--btn-cancel-border)] transition-all cursor-pointer bg-transparent mt-0.5"
                                    >
                                        <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                </div>
                            );
                        })}
                    </div>

                    <button
                        type="button"
                        onClick={onAddEditItem}
                        className="w-full mt-2 flex items-center justify-center gap-2 py-2.5 text-xs font-semibold text-[var(--text-muted)] hover:text-[var(--text-main)] border border-dashed border-[var(--border-color)] rounded-xl hover:border-[var(--border-soft)] hover:bg-[var(--bg-secondary)] transition-all cursor-pointer bg-transparent"
                    >
                        <Plus className="w-3.5 h-3.5" />
                        {dict.invoices?.add_concept ?? "Añadir concepto"}
                    </button>

                    <div className="mt-6 border-t border-[var(--border-soft)] pt-4 flex justify-end">
                        <div className="w-64 space-y-1.5 text-xs">
                            <div className="flex justify-between text-[var(--text-muted)]">
                                <span>Base imponible:</span>
                                <span className="font-mono">{formatCurrency(editSubtotal)}</span>
                            </div>
                            <div className="flex justify-between text-base font-bold text-[var(--text-main)] border border-accent/20 pt-3 pb-3 px-4 rounded-2xl bg-accent/5 dark:bg-accent/10">
                                <span className="text-accent dark:text-accent font-extrabold">Total estimado:</span>
                                <span className="text-accent dark:text-accent font-mono font-black text-xl">{formatCurrency(editTotalAmount)}</span>
                            </div>
                        </div>
                    </div>
                </div>
            ) : (
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="border-b-2 border-accent/20 text-[10px] uppercase font-black tracking-wider text-[var(--text-muted)] print:text-neutral-600 print:border-neutral-300 bg-accent/5 dark:bg-accent/10 rounded-t-2xl">
                            <th className="py-3 px-4 rounded-l-xl">{dict.invoices?.concept ?? "Concepto"}</th>
                            <th className="py-3 px-4 text-center w-20">{dict.invoices?.quantity ?? "Cant."}</th>
                            <th className="py-3 px-4 text-right w-28">{dict.invoices?.price ?? "Precio"}</th>
                            <th className="py-3 px-4 text-right w-32 rounded-r-xl">{dict.invoices?.subtotal ?? "Subtotal"}</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--border-soft)]/20 text-xs print:divide-neutral-200">
                        {quote.items && quote.items.length > 0 ? (
                            quote.items.map((item, idx) => (
                                <tr
                                    key={item.id}
                                    className={`print:text-black hover:bg-accent/5 dark:hover:bg-accent/10 transition-colors ${
                                        idx % 2 === 0 ? "bg-transparent" : "bg-accent/[0.02] dark:bg-accent/[0.04]"
                                    }`}
                                >
                                    <td className="py-4 px-4 font-medium text-[var(--text-main)] print:text-black max-w-xs break-words whitespace-pre-wrap leading-relaxed">
                                        {item.description}
                                    </td>
                                    <td className="py-4 px-4 text-center font-semibold text-[var(--text-muted)] print:text-black font-mono">
                                        {item.quantity}
                                    </td>
                                    <td className="py-4 px-4 text-right text-[var(--text-muted)] print:text-black font-mono">
                                        {formatCurrency(item.unit_price)}
                                    </td>
                                    <td className="py-4 px-4 text-right font-bold text-[var(--text-main)] print:text-black font-mono">
                                        {formatCurrency(item.subtotal)}
                                    </td>
                                </tr>
                            ))
                        ) : (
                            <tr>
                                <td colSpan={4} className="py-8 text-center text-[var(--text-muted)] print:text-black font-medium">
                                    No hay líneas en este presupuesto.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            )}
        </div>
    );
}
