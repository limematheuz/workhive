"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import { useResourceEffect } from "@/hooks/useResourceEffect";
import { QuoteService } from "@/services/quote.service";
import type { Quote } from "@/types/quote";
import { formatCurrency, formatDate } from "@/lib/format";
import { QUOTE_STATUS_BADGE } from "@/lib/constants";
import { useDictionary } from "@/lib/dictionary-context";

export function ClientQuotesTab({ clientId }: { clientId: number }) {
    const [quotes, setQuotes] = useState<Quote[] | null>(null);
    const [error, setError] = useState("");
    const { dict } = useDictionary();
    const request = useCallback(() => QuoteService.getAllQuotes({ clientId }), [clientId]);
    useResourceEffect(true, String(clientId), request, (data) => { setQuotes(data); setError(""); }, () => setError("No se han podido consultar los presupuestos de este cliente."));
    if (error) return <p role="alert" className="rounded-xl border border-orange-400/40 p-4 text-sm">{error}</p>;
    if (quotes === null) return <p role="status" className="p-4 text-sm text-muted-foreground">Consultando presupuestos…</p>;
    if (quotes.length === 0) return <p className="p-4 text-sm text-muted-foreground">Este cliente todavía no tiene presupuestos.</p>;
    const labels: Record<string, string> = { draft: dict.quotes.status_draft, sent: dict.quotes.status_sent, accepted: dict.quotes.status_accepted, rejected: dict.quotes.status_rejected, expired: dict.quotes.status_expired };
    return <div className="space-y-2">{quotes.map((quote) => <Link key={quote.id} href={`/dashboard/quotes?quote=${quote.id}`} className="billing-surface flex flex-wrap items-center justify-between gap-3 rounded-xl p-4 focus-visible:outline-2 focus-visible:outline-accent"><span className="min-w-0 flex-1"><span className="block text-sm font-semibold">{quote.quote_number} · {quote.title}</span><span className="text-xs text-muted-foreground">{formatDate(quote.created_at)}{quote.valid_until ? ` · Válido hasta ${formatDate(quote.valid_until)}` : " · Sin fecha de validez"}</span></span><span className={`rounded-full border px-2 py-1 text-xs ${QUOTE_STATUS_BADGE[quote.status]}`}>{labels[quote.status]}</span><strong className="text-sm tabular-nums">{formatCurrency(quote.total_amount)}</strong></Link>)}</div>;
}
