"use client"

import Image from "next/image"
import { resolveApiMediaUrl } from "@/lib/api"
import { Quote } from "@/types/quote"
import type { Dictionary } from "@/lib/dictionary-context"

interface QuoteDetailNotesProps {
    quote: Quote
    dict: Dictionary
}

export function QuoteDetailNotes({ quote, dict }: QuoteDetailNotesProps) {
    const hasNotes = Boolean(quote.notes)
    const hasTerms = Boolean(quote.terms)
    const hasSignature = Boolean(quote.signature_url)

    if (!hasNotes && !hasTerms && !hasSignature) {
        return null
    }

    return (
        <>
            {(hasNotes || hasTerms) && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {quote.notes && (
                        <div className="bg-[var(--bg-primary)]/30 border border-[var(--border-soft)] rounded-xl p-4">
                            <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] mb-2">
                                {dict.quotes?.notes_label || "Notas"}
                            </p>
                            <p className="text-sm text-[var(--text-main)] whitespace-pre-wrap">{quote.notes}</p>
                        </div>
                    )}
                    {quote.terms && (
                        <div className="bg-[var(--bg-primary)]/30 border border-[var(--border-soft)] rounded-xl p-4">
                            <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] mb-2">
                                {dict.invoices?.terms_conditions || "Términos y condiciones"}
                            </p>
                            <p className="text-sm text-[var(--text-main)] whitespace-pre-wrap">{quote.terms}</p>
                        </div>
                    )}
                </div>
            )}

            {quote.signature_url && (
                <div className="bg-[var(--bg-primary)]/30 border border-[var(--border-soft)] rounded-xl p-4 max-w-xs">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] mb-2">
                        {dict.invoices?.issuer_signature || "Firma del Emisor"}
                    </p>
                    <Image
                        src={resolveApiMediaUrl(quote.signature_url) || ""}
                        alt="Firma"
                        width={160}
                        height={60}
                        className="max-h-[60px] object-contain"
                        unoptimized
                    />
                </div>
            )}
        </>
    )
}
