import { readListAppearance, type ListAppearance } from "./list-appearance.ts";

export type SavedViewState = { version: 1; viewKey: string; filters: Record<string, string>; appearance?: ListAppearance };
export type SavedView = SavedViewState & { id: string; name: string; updatedAt: string };
function record(value: unknown): value is Record<string, unknown> { return Boolean(value && typeof value === "object" && !Array.isArray(value)); }
export function viewFilters(value: unknown, keys: readonly string[]): Record<string, string> | null {
    if (!record(value) || keys.length > 30) return null;
    const result: Record<string, string> = {};
    for (const key of keys) {
        const field = value[key] ?? "";
        if (typeof field !== "string" || field.length > 1000) return null;
        result[key] = field;
    }
    return result;
}
function state(value: unknown, viewKey: string, keys: readonly string[]): SavedViewState | null {
    if (!record(value) || value.version !== 1 || value.viewKey !== viewKey) return null;
    const filters = viewFilters(value.filters, keys);
    if (!filters) return null;
    const appearance = record(value.appearance) ? readListAppearance(JSON.stringify(value.appearance)) : undefined;
    return { version: 1, viewKey, filters, ...(appearance ? { appearance } : {}) };
}
export function readSavedViews(raw: string | null, viewKey: string, keys: readonly string[]): SavedView[] {
    if (!raw || raw.length > 131072) return [];
    try {
        const data: unknown = JSON.parse(raw);
        if (!Array.isArray(data)) return [];
        const rows: SavedView[] = [];
        for (const item of data.slice(0, 20)) {
            const parsed = state(item, viewKey, keys);
            if (!parsed || !record(item) || typeof item.id !== "string" || item.id.length > 100 || typeof item.name !== "string" || !item.name.trim() || item.name.length > 60 || typeof item.updatedAt !== "string") continue;
            rows.push({ ...parsed, id: item.id, name: item.name, updatedAt: item.updatedAt });
        }
        return rows;
    } catch { return []; }
}
export function readSharedView(raw: string | null, viewKey: string, keys: readonly string[]): SavedViewState | null {
    if (!raw || raw.length > 8192) return null;
    try { return state(JSON.parse(raw), viewKey, keys); } catch { return null; }
}
export function shareViewUrl(base: string, snapshot: SavedViewState): string {
    const target = new URL(base);
    if (!['http:', 'https:'].includes(target.protocol)) throw new Error("No se pudo preparar el enlace de esta vista.");
    for (const [key, value] of Object.entries(snapshot.filters)) {
        if (value) target.searchParams.set(key, value); else target.searchParams.delete(key);
    }
    target.searchParams.set("wh_view", JSON.stringify(snapshot));
    if (target.href.length > 12000) throw new Error("Reduce los filtros antes de compartir esta vista.");
    return target.href;
}
