export type ClientPortalAttention = "all" | "respond" | "validate" | "unresolved";
export type ClientPortalActionTab = "quotes" | "inspections" | "complaints" | "services" | "invoices" | "contracts";

export function clientQuoteNeedsDecision(quote: { status: string; valid_until?: string | null }, now = Date.now()): boolean {
    if (quote.status !== "sent") return false;
    if (!quote.valid_until) return true;
    const raw = quote.valid_until;
    const parsed = Date.parse(/Z$|[+-]\d{2}:\d{2}$/.test(raw) ? raw : `${raw}Z`);
    return Number.isFinite(parsed) && parsed > now;
}

export function portalComplaintUnresolved(complaint: { status: string }): boolean {
    return complaint.status === "submitted" || complaint.status === "in_review";
}

export function partnerRequestPending(request: { cleaning_status?: string | null }): boolean {
    return !["completed", "cancelled"].includes(request.cleaning_status ?? "");
}

export function upcomingPartnerRequests<T extends { check_out_at: string; cleaning_status?: string | null }>(requests: T[], reference: number): T[] {
    return requests.filter((request) => partnerRequestPending(request) && Date.parse(request.check_out_at) >= reference)
        .sort((first, second) => Date.parse(first.check_out_at) - Date.parse(second.check_out_at));
}

export function advisoryRequestStep(request: { response: string | null }): "company" | "response_available" {
    return request.response === null ? "company" : "response_available";
}

export function portalTextMatches(search: string, values: Array<string | null | undefined>): boolean {
    const normalized = (value: string) => value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase();
    const needle = normalized(search.trim());
    return !needle || values.some((value) => value && normalized(value).includes(needle));
}
