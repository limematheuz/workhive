"use client"

import { formatDate } from "@/lib/format"
import { Quote } from "@/types/quote"
import type { Dictionary } from "@/lib/dictionary-context"

interface QuoteDetailMetaProps {
    quote: Quote
    dict: Dictionary
    clientName: string
}

export function QuoteDetailMeta({ quote, dict, clientName }: QuoteDetailMetaProps) {
    return (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div className="bg-[var(--bg-primary)]/30 border border-[var(--border-soft)] rounded-xl p-3">
                <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] mb-1">
                    {dict.quotes?.client_label ?? "Cliente"}
                </p>
                <p className="text-sm font-semibold text-[var(--text-main)] truncate">
                    {clientName}
                </p>
            </div>
            <div className="bg-[var(--bg-primary)]/30 border border-[var(--border-soft)] rounded-xl p-3">
                <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] mb-1">
                    {dict.quotes?.created_label ?? "Fecha"}
                </p>
                <p className="text-sm font-semibold text-[var(--text-main)]">
                    {formatDate(quote.created_at)}
                </p>
            </div>
            <div className="bg-[var(--bg-primary)]/30 border border-[var(--border-soft)] rounded-xl p-3">
                <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] mb-1">
                    {dict.quotes?.valid_until_label ?? "Válido hasta"}
                </p>
                <p className="text-sm font-semibold text-[var(--text-main)]">
                    {formatDate(quote.valid_until)}
                </p>
            </div>
        </div>
    )
}
