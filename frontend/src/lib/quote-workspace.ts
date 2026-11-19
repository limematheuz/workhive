type WorkspaceQuote = { quote_number: string; title: string; status: string; client_id: number | null; valid_until: string | null; total_amount: number };
export type QuoteAttention = "all" | "respond" | "expiring" | "accepted";

export function quoteExpiresSoon(quote: WorkspaceQuote, today: string): boolean {
    if (quote.status !== "sent" || !quote.valid_until) return false;
    const due = quote.valid_until.slice(0, 10);
    const days = (Date.parse(due) - Date.parse(today)) / 86_400_000;
    return Number.isFinite(days) && days >= 0 && days <= 7;
}

export function filterWorkspaceQuotes<T extends WorkspaceQuote>(quotes: T[], filters: {
    search: string; clientId: string; status: string; attention: QuoteAttention; today: string;
    clientName: (quote: T) => string;
}): T[] {
    const needle = filters.search.trim().toLocaleLowerCase();
    return quotes.filter((quote) => (!filters.clientId || String(quote.client_id) === filters.clientId)
        && (!filters.status || quote.status === filters.status)
        && (!needle || `${quote.quote_number} ${quote.title} ${filters.clientName(quote)}`.toLocaleLowerCase().includes(needle))
        && (filters.attention === "all" || (filters.attention === "respond" && quote.status === "sent")
            || (filters.attention === "accepted" && quote.status === "accepted")
            || (filters.attention === "expiring" && quoteExpiresSoon(quote, filters.today))));
}
