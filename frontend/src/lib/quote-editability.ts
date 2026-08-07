import type { Quote } from "@/types/quote";

/** Content can still change after email (status → sent). Locked once accepted/rejected/expired. */
const CONTENT_EDITABLE_STATUSES = new Set<Quote["status"]>(["draft", "sent"]);

export function isQuoteContentEditable(status: Quote["status"] | string): boolean {
    return CONTENT_EDITABLE_STATUSES.has(status as Quote["status"]);
}
