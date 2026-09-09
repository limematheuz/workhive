import type { Quote } from "@/types/quote";

/** A sent quote is an immutable commercial version. Start a revision to edit it. */
const CONTENT_EDITABLE_STATUSES = new Set<Quote["status"]>(["draft"]);

export function isQuoteContentEditable(status: Quote["status"] | string): boolean {
    return CONTENT_EDITABLE_STATUSES.has(status as Quote["status"]);
}
