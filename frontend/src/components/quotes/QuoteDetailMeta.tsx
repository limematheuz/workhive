"use client";

import { formatDate, formatQuoteNumber } from "@/lib/format";
import type { Dictionary } from "@/lib/dictionary-context";
import type { Quote } from "@/types/quote";

type QuoteDetailMetaProps = {
    quote: Quote;
    dict: Dictionary;
    clientName: string;
    companyName?: string;
    statusLabel: string;
};

export function QuoteDetailMeta({
    quote,
    dict,
    clientName,
    companyName,
    statusLabel,
}: QuoteDetailMetaProps) {
    const issuerName = quote.custom_issuer_info?.split("\n")[0]?.trim()
        || companyName
        || "WorkHive";

    return (
        <section className="grid gap-3 pb-5 pt-4 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.12fr)_minmax(14rem,0.98fr)] lg:items-stretch">
            <section className="rounded-2xl bg-[var(--bg-tertiary)] p-3.5">
                <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--bg-card-solid)] text-xs font-semibold text-[var(--text-main)]">
                        {issuerName.substring(0, 2).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                            {dict.invoices?.issuer || "Emisor"}
                        </p>
                        <p className="truncate text-sm font-semibold text-[var(--text-main)]">
                            {issuerName}
                        </p>
                    </div>
                </div>
                <div className="mt-2 text-[10px] leading-4 text-[var(--text-muted)]">
                    {quote.custom_issuer_info ? (
                        <p className="whitespace-pre-line">{quote.custom_issuer_info}</p>
                    ) : (
                        <p>{companyName || "—"}</p>
                    )}
                </div>
            </section>

            <section className="rounded-2xl bg-[var(--bg-tertiary)] p-3.5">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                    {dict.invoices?.billed_to || dict.quotes?.client_label || "Cliente"}
                </p>
                <h3 className="mt-1 truncate text-sm font-semibold leading-tight text-[var(--text-main)]">
                    {clientName}
                </h3>
                <div className="mt-2 grid gap-1 text-[10px] leading-4 text-[var(--text-muted)]">
                    {quote.custom_recipient_info ? (
                        <p className="whitespace-pre-line">{quote.custom_recipient_info}</p>
                    ) : (
                        <p>{clientName}</p>
                    )}
                </div>
            </section>

            <section className="rounded-2xl bg-[color-mix(in_srgb,var(--btn-secondary-bg)_62%,var(--bg-secondary))] p-3.5 text-left lg:text-right">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                    {statusLabel}
                </p>
                <h2 className="mt-1 break-all font-mono text-lg font-semibold leading-tight text-[var(--text-main)]">
                    {formatQuoteNumber(quote.quote_number)}
                </h2>
                <p className="mt-1 truncate text-xs text-[var(--text-muted)]">{quote.title}</p>
                <div className="mt-3 grid grid-cols-1 gap-2 text-left text-[10px] sm:grid-cols-2">
                    <div className="min-h-[4.25rem] rounded-xl bg-[var(--bg-tertiary)] px-3.5 py-2.5">
                        <span className="block text-[9px] font-semibold uppercase leading-4 text-[var(--text-muted)]">
                            {dict.quotes?.created_label || "Fecha"}
                        </span>
                        <span className="mt-1 block font-mono font-semibold leading-5 text-[var(--text-main)]">
                            {formatDate(quote.created_at)}
                        </span>
                    </div>
                    {quote.valid_until && (
                        <div className="min-h-[4.25rem] rounded-xl bg-[var(--bg-tertiary)] px-3.5 py-2.5">
                            <span className="block text-[9px] font-semibold uppercase leading-4 text-[var(--text-muted)]">
                                {dict.quotes?.valid_until_label || "Válido hasta"}
                            </span>
                            <span className="mt-1 block font-mono font-semibold leading-5 text-[var(--text-main)]">
                                {formatDate(quote.valid_until)}
                            </span>
                        </div>
                    )}
                </div>
            </section>
        </section>
    );
}
