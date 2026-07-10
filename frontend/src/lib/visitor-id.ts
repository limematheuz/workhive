const VISITOR_ID_KEY = "workhive_visitor_id";

function createVisitorId(): string {
    if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
        return crypto.randomUUID();
    }
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 14)}`;
}

export function getVisitorId(): string {
    if (typeof window === "undefined") return "";
    const existing = localStorage.getItem(VISITOR_ID_KEY);
    if (existing) return existing;
    const created = createVisitorId();
    localStorage.setItem(VISITOR_ID_KEY, created);
    return created;
}
