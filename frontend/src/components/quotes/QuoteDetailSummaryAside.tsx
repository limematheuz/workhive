"use client";

import { QUOTE_STATUS_BADGE } from "@/lib/constants";
import type { Dictionary } from "@/lib/dictionary-context";
import { formatCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Quote } from "@/types/quote";

type QuoteDetailSummaryAsideProps = {
    quote: Quote;
    dict: Dictionary;
    statusLabel: string;
};

export function QuoteDetailSummaryAside({
    quote,
    dict,
    statusLabel,
}: QuoteDetailSummaryAsideProps) {
    return (
        <aside className="relative z-10 hidden space-y-3 print:hidden lg:sticky lg:top-0 lg:block lg:self-start">
            <section className="billing-surface relative overflow-hidden rounded-[24px] p-4 pt-6">
                <div className="absolute left-4 right-4 top-3 h-1.5 rounded-full bg-accent" />
                <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                    {dict.invoices?.dashboard_summary || "Resumen"}
                </p>
                <div className="mt-3 space-y-3">
                    <div>
                        <p className="text-[10px] font-semibold uppercase text-[var(--text-muted)]">
                            {dict.invoices?.total_amount || "Total"}
                        </p>
                        <p className="mt-1 font-mono text-xl font-semibold text-[var(--text-main)]">
                            {formatCurrency(quote.total_amount)}
                        </p>
                    </div>
                    <div className="grid grid-cols-1 gap-2 text-[11px]">
                        <div className="rounded-2xl bg-[var(--bg-tertiary)] p-3">
                            <p className="font-semibold uppercase text-[var(--text-muted)]">
                                {dict.invoices?.base_amount || "Base"}
                            </p>
                            <p className="mt-1 font-mono font-semibold text-[var(--text-main)]">
                                {formatCurrency(quote.base_amount)}
                            </p>
                        </div>
                        <div className="rounded-2xl bg-[var(--bg-tertiary)] p-3">
                            <p className="font-semibold uppercase text-[var(--text-muted)]">
                                {dict.invoices?.tax || "IVA"}
                            </p>
                            <p className="mt-1 font-mono font-semibold text-[var(--text-main)]">
                                {formatCurrency(quote.tax_amount)}
                            </p>
                        </div>
                    </div>
                    <div className="rounded-2xl bg-[var(--bg-tertiary)] p-3">
                        <p className="text-[10px] font-semibold uppercase text-[var(--text-muted)]">
                            {dict.quotes?.col_status || "Estado"}
                        </p>
                        <span
                            className={cn(
                                "mt-2 inline-flex rounded-full border px-3 py-1 text-[11px] font-semibold uppercase",
                                QUOTE_STATUS_BADGE[quote.status] ?? QUOTE_STATUS_BADGE.draft,
                            )}
                        >
                            {statusLabel}
                        </span>
                    </div>
                </div>
            </section>
        </aside>
    );
}
