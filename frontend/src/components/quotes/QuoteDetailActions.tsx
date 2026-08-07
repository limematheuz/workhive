"use client";

import {
    CheckCircle,
    Download,
    Loader2,
    Mail,
    Send,
    XCircle,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { QUOTE_STATUS_BADGE } from "@/lib/constants";
import type { Dictionary } from "@/lib/dictionary-context";
import { formatCurrency, formatDate, formatQuoteNumber } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Quote } from "@/types/quote";

type QuoteDetailActionsProps = {
    quote: Quote;
    dict: Dictionary;
    loading: boolean;
    clientName: string;
    statusLabel: string;
    onDownload: () => void;
    onSendEmail: () => void;
    onMarkSent: () => void;
    onMarkAccepted: () => void;
    onMarkRejected: () => void;
};

export function QuoteDetailActions({
    quote,
    dict,
    loading,
    clientName,
    statusLabel,
    onDownload,
    onSendEmail,
    onMarkSent,
    onMarkAccepted,
    onMarkRejected,
}: QuoteDetailActionsProps) {
    const summaryCards = [
        {
            label: dict.invoices?.total_amount || "Total",
            value: formatCurrency(quote.total_amount),
            mono: true,
        },
        {
            label: dict.quotes?.client_label || "Cliente",
            value: clientName,
            mono: false,
        },
        {
            label: dict.quotes?.created_label || "Fecha",
            value: formatDate(quote.created_at),
            mono: true,
        },
        {
            label: quote.valid_until
                ? (dict.quotes?.valid_until_label || "Válido hasta")
                : (dict.quotes?.col_status || "Estado"),
            value: quote.valid_until ? formatDate(quote.valid_until) : statusLabel,
            mono: Boolean(quote.valid_until),
        },
    ];

    const showEmail = quote.status === "draft" || quote.status === "sent";
    const showDraftActions = quote.status === "draft";
    const showSentActions = quote.status === "sent";

    return (
        <section className="billing-surface rounded-[24px] p-4 sm:p-5">
            <header className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs font-semibold uppercase tracking-[0.1em] text-[var(--text-muted)]">
                            {dict.quotes?.title || "Presupuesto"}
                        </span>
                        <span
                            className={cn(
                                "rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase leading-none",
                                QUOTE_STATUS_BADGE[quote.status] ?? QUOTE_STATUS_BADGE.draft,
                            )}
                        >
                            {statusLabel}
                        </span>
                    </div>
                    <h1 className="mt-1 max-w-full text-[clamp(1.25rem,1.8vw,1.75rem)] font-bold leading-none tracking-tight text-[var(--text-main)] [overflow-wrap:anywhere]">
                        {formatQuoteNumber(quote.quote_number)}
                    </h1>
                    <p className="mt-2 truncate text-sm text-[var(--text-muted)]">{quote.title}</p>
                </div>

                <Button
                    type="button"
                    onClick={onDownload}
                    disabled={loading}
                    className="w-full xl:w-auto xl:min-w-[13rem]"
                >
                    {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                    {dict.quotes?.download_pdf ?? "Descargar PDF"}
                </Button>
            </header>

            <section className="mt-4 grid gap-2 md:grid-cols-2 xl:grid-cols-4">
                {summaryCards.map((card) => (
                    <div key={card.label} className="billing-block min-w-0 rounded-xl px-3 py-2.5">
                        <p className="truncate text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--text-muted)]">
                            {card.label}
                        </p>
                        <p className={cn("mt-1.5 truncate text-base font-semibold text-[var(--text-main)]", card.mono && "font-mono")}>
                            {card.value}
                        </p>
                    </div>
                ))}
            </section>

            {(showEmail || showDraftActions || showSentActions) && (
                <section className="mt-4 flex flex-wrap gap-2 border-t border-[var(--border-soft)] pt-4">
                    {showEmail && (
                        <Button type="button" variant="secondary" disabled={loading} onClick={onSendEmail}>
                            <Mail className="h-4 w-4" />
                            Enviar por email
                        </Button>
                    )}
                    {showDraftActions && (
                        <Button type="button" disabled={loading} onClick={onMarkSent}>
                            <Send className="h-4 w-4" />
                            {dict.quotes?.mark_sent ?? "Marcar enviado"}
                        </Button>
                    )}
                    {showSentActions && (
                        <>
                            <Button type="button" disabled={loading} onClick={onMarkAccepted}>
                                <CheckCircle className="h-4 w-4" />
                                {dict.quotes?.mark_accepted ?? "Marcar aceptado"}
                            </Button>
                            <Button type="button" variant="dangerSoft" disabled={loading} onClick={onMarkRejected}>
                                <XCircle className="h-4 w-4" />
                                {dict.quotes?.mark_rejected ?? "Marcar rechazado"}
                            </Button>
                        </>
                    )}
                </section>
            )}
        </section>
    );
}
