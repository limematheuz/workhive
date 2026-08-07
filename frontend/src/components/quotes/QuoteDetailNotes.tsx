"use client";

import Image from "next/image";

import { resolveApiMediaUrl } from "@/lib/api";
import type { Dictionary } from "@/lib/dictionary-context";
import type { Quote } from "@/types/quote";

type QuoteDetailNotesProps = {
    quote: Quote;
    dict: Dictionary;
};

export function QuoteDetailNotes({ quote, dict }: QuoteDetailNotesProps) {
    const hasNotes = Boolean(quote.notes);
    const hasTerms = Boolean(quote.terms);
    const hasSignature = Boolean(quote.signature_url);
    const hasShipping = Boolean(quote.shipping_address);

    if (!hasNotes && !hasTerms && !hasSignature && !hasShipping) {
        return null;
    }

    return (
        <section className="mt-6 space-y-3 pt-5">
            {hasShipping && (
                <div className="rounded-2xl bg-[var(--bg-tertiary)] p-3.5 text-xs text-[var(--text-muted)]">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-main)]">
                        {dict.invoices?.shipping_address || "Dirección de envío"}
                    </p>
                    <p className="mt-2 whitespace-pre-line leading-5">{quote.shipping_address}</p>
                </div>
            )}

            {(hasNotes || hasTerms) && (
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    {quote.notes && (
                        <section className="rounded-2xl bg-[var(--bg-tertiary)] p-3.5 text-xs text-[var(--text-muted)]">
                            <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-main)]">
                                {dict.quotes?.notes_label || "Notas"}
                            </p>
                            <p className="mt-2 whitespace-pre-line leading-5">{quote.notes}</p>
                        </section>
                    )}
                    {quote.terms && (
                        <section className="rounded-2xl bg-[var(--bg-tertiary)] p-3.5 text-xs text-[var(--text-muted)]">
                            <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-main)]">
                                {dict.invoices?.terms_conditions || "Términos y condiciones"}
                            </p>
                            <p className="mt-2 whitespace-pre-line leading-5">{quote.terms}</p>
                        </section>
                    )}
                </div>
            )}

            {quote.signature_url && (
                <div className="flex flex-col items-start gap-2">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                        {dict.invoices?.issuer_signature || "Firma del Emisor"}
                    </span>
                    <Image
                        src={resolveApiMediaUrl(quote.signature_url) || ""}
                        alt="Firma"
                        width={160}
                        height={64}
                        className="max-h-16 rounded-xl bg-[var(--bg-tertiary)] p-1 object-contain"
                        unoptimized
                    />
                </div>
            )}
        </section>
    );
}
