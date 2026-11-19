export type ListAppearance = { density: "comfortable" | "compact"; hidden: string[]; sort: string };
export type AppearanceColumn = { key: string; hideable?: boolean };
export const DEFAULT_LIST_APPEARANCE: ListAppearance = { density: "comfortable", hidden: [], sort: "default" };

export function readListAppearance(raw: string | null, columns?: readonly AppearanceColumn[]): ListAppearance {
    if (!raw || raw.length > 8192) return { ...DEFAULT_LIST_APPEARANCE, hidden: [] };
    try {
        const value: unknown = JSON.parse(raw);
        if (!value || typeof value !== "object" || Array.isArray(value)) return { ...DEFAULT_LIST_APPEARANCE, hidden: [] };
        const row = value as Record<string, unknown>;
        const allowed = columns ? new Map(columns.map(column => [column.key, column])) : null;
        const hidden = [...new Set(Array.isArray(row.hidden) ? row.hidden.filter((key): key is string => typeof key === "string" && key.length <= 100) : [])]
            .slice(0, 60).filter(key => !allowed || (allowed.has(key) && allowed.get(key)?.hideable !== false));
        if (columns?.length && columns.every(column => hidden.includes(column.key))) hidden.splice(hidden.indexOf(columns[0].key), 1);
        return {
            density: row.density === "compact" ? "compact" : "comfortable",
            hidden,
            sort: typeof row.sort === "string" && row.sort.length <= 100 ? row.sort : "default",
        };
    } catch { return { ...DEFAULT_LIST_APPEARANCE, hidden: [] }; }
}

export function orderedListItems<T>(items: readonly T[], compare?: (first: T, second: T) => number): T[] {
    return compare ? [...items].sort(compare) : items as T[];
}
