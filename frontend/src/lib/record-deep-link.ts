export type RecordTarget = { present: boolean; id: number | null; error: string | null };
type SearchParams = Pick<URLSearchParams, "getAll" | "toString">;

export function linkedRecordTarget(params: SearchParams, key: string): RecordTarget {
    const values = params.getAll(key);
    if (!values.length) return { present: false, id: null, error: null };
    const id = values.length === 1 && /^[1-9]\d*$/.test(values[0]) ? Number(values[0]) : NaN;
    return Number.isSafeInteger(id) && id > 0
        ? { present: true, id, error: null }
        : { present: true, id: null, error: "El identificador del enlace no es válido." };
}

export function recordLinkUrl(pathname: string, params: Pick<URLSearchParams, "toString">,
        changes: Record<string, string | number | null>): string {
    const next = new URLSearchParams(params.toString());
    for (const [key, value] of Object.entries(changes)) {
        if (value === null) next.delete(key);
        else next.set(key, String(value));
    }
    return pathname + (next.size ? "?" + next.toString() : "");
}

export const INCIDENT_FILTERS = ["all", "active", "open", "in_progress", "resolved"] as const;
export type IncidentFilter = typeof INCIDENT_FILTERS[number];
export function incidentFilter(params: SearchParams): { value: IncidentFilter; invalid: boolean } {
    const values = params.getAll("status");
    if (!values.length) return { value: "all", invalid: false };
    const valid = values.length === 1 && INCIDENT_FILTERS.some(value => value === values[0]);
    return { value: valid ? values[0] as IncidentFilter : "all", invalid: !valid };
}
export function matchesIncidentFilter(status: string, filter: IncidentFilter): boolean {
    return filter === "all" || (filter === "active" ? status === "open" || status === "in_progress" : status === filter);
}
