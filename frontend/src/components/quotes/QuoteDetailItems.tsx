"use client"

import { formatCurrency } from "@/lib/format"
import { splitStoredTaxAmount } from "@/lib/billing-calculations"
import { Quote } from "@/types/quote"
import type { Dictionary } from "@/lib/dictionary-context"

interface QuoteDetailItemsProps {
    quote: Quote
    dict: Dictionary
}

export function QuoteDetailItems({ quote, dict }: QuoteDetailItemsProps) {
    const linesSubtotal = quote.items.reduce((acc, item) => acc + item.subtotal, 0)
    const { pureVatAmount, surchargeAmount } = splitStoredTaxAmount(
        quote.tax_amount,
        quote.base_amount,
        quote.equivalence_surcharge || 0,
    )

    return (
        <div>
            <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
                    {dict.quotes?.items_label ?? "Líneas"}
                </p>
            </div>
            <div className="bg-[var(--bg-primary)]/30 border border-[var(--border-soft)] rounded-2xl overflow-hidden">
                <div className="grid grid-cols-[1fr_75px_100px_100px] gap-2 px-4 py-2.5 bg-[var(--bg-primary)]/50 border-b border-[var(--border-soft)]">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Descripción</span>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] text-center">Cant.</span>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] text-right">Precio</span>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] text-right">Subtotal</span>
                </div>

                <div className="divide-y divide-[var(--border-soft)]">
                    {quote.items.map((item) => (
                        <div key={item.id} className="grid grid-cols-[1fr_75px_100px_100px] gap-2 px-4 py-3 items-center">
                            <span className="text-sm text-[var(--text-main)] whitespace-pre-wrap break-words">{item.description}</span>
                            <span className="text-sm text-[var(--text-muted)] text-center">{item.quantity}</span>
                            <span className="text-sm text-[var(--text-muted)] text-right">{formatCurrency(item.unit_price)}</span>
                            <span className="text-sm font-semibold text-[var(--text-main)] text-right">{formatCurrency(item.subtotal)}</span>
                        </div>
                    ))}
                </div>

                <div className="border-t border-[var(--border-soft)] bg-[var(--bg-card)] px-4 py-3 space-y-1.5">
                    <div className="flex justify-between text-xs text-[var(--text-muted)]">
                        <span>{dict.invoices?.subtotal_desc || "Subtotal (Suma de líneas)"}</span>
                        <span className="font-semibold">
                            {formatCurrency(linesSubtotal)}
                        </span>
                    </div>

                    {quote.discount > 0 && (
                        <div className="flex items-center justify-between text-xs text-[var(--text-muted)]">
                            <span>{dict.invoices?.global_discount || "Descuento (%)"}</span>
                            <span className="font-semibold">-{formatCurrency(linesSubtotal * (quote.discount / 100))} ({quote.discount}%)</span>
                        </div>
                    )}

                    <div className="flex justify-between text-xs text-[var(--text-muted)]">
                        <span>{dict.invoices?.base_amount || "Base imponible"}</span>
                        <span className="font-semibold">
                            {formatCurrency(quote.base_amount)}
                        </span>
                    </div>

                    <div className="flex justify-between text-xs text-[var(--text-muted)]">
                        <span>IVA ({Math.round((quote.tax_rate ?? 0.21) * 100)}%)</span>
                        <span className="font-semibold">{formatCurrency(pureVatAmount)}</span>
                    </div>

                    {quote.equivalence_surcharge > 0 && (
                        <div className="flex items-center justify-between text-xs text-[var(--text-muted)]">
                            <span>{dict.invoices?.equivalence_surcharge || "Recargo Equiv. (%)"}</span>
                            <span className="font-semibold">{formatCurrency(surchargeAmount)} ({quote.equivalence_surcharge}%)</span>
                        </div>
                    )}

                    {quote.retention > 0 && (
                        <div className="flex items-center justify-between text-xs text-[var(--text-muted)]">
                            <span>{dict.invoices?.retention_irpf || "Retención (IRPF %)"}</span>
                            <span className="font-semibold text-rose-500">-{formatCurrency(quote.base_amount * (quote.retention / 100))} ({quote.retention}%)</span>
                        </div>
                    )}

                    <div className="flex justify-between text-sm font-black text-[var(--text-main)] pt-1 border-t border-[var(--border-soft)]">
                        <span>TOTAL</span>
                        <span>{formatCurrency(quote.total_amount)}</span>
                    </div>
                </div>
            </div>
        </div>
    )
}
