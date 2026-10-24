import { createClientId } from "@/lib/editable-line-key";

const VISITOR_ID_KEY = "workhive_visitor_id";

export function getVisitorId(): string {
    if (typeof window === "undefined") return "";
    const existing = localStorage.getItem(VISITOR_ID_KEY);
    if (existing) return existing;
    const created = createClientId();
    localStorage.setItem(VISITOR_ID_KEY, created);
    return created;
}
