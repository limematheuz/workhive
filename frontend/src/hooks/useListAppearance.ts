"use client";
import { useCallback, useMemo, useState, useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";
import { browserViewStateKey } from "@/lib/view-state-storage";
import { readListAppearance, type AppearanceColumn, type ListAppearance } from "@/lib/list-appearance";

export const LIST_APPEARANCE_EVENT = "workhive:list-appearance";
export function listAppearanceStorageKey(path: string, name: string) { return browserViewStateKey(path, "appearance." + name); }
export function readListAppearanceStorage(key: string) { try { return localStorage.getItem(key); } catch { return null; } }
export function writeListAppearanceStorage(key: string, value: ListAppearance) {
    localStorage.setItem(key, JSON.stringify(readListAppearance(JSON.stringify(value))));
    window.dispatchEvent(new Event(LIST_APPEARANCE_EVENT));
}
const serverSnapshot = () => null;
export function useListAppearance(name: string, columns: readonly AppearanceColumn[]) {
    const path = usePathname(), key = listAppearanceStorageKey(path, name);
    const [error, setError] = useState("");
    const subscribe = useCallback((listener: () => void) => {
        window.addEventListener("storage", listener); window.addEventListener(LIST_APPEARANCE_EVENT, listener);
        return () => { window.removeEventListener("storage", listener); window.removeEventListener(LIST_APPEARANCE_EVENT, listener); };
    }, []);
    const snapshot = useCallback(() => readListAppearanceStorage(key), [key]);
    const raw = useSyncExternalStore(subscribe, snapshot, serverSnapshot);
    const appearance = useMemo(() => readListAppearance(raw, columns), [raw, columns]);
    const change = useCallback((patch: Partial<ListAppearance>) => {
        try {
            const current = readListAppearance(readListAppearanceStorage(key), columns);
            writeListAppearanceStorage(key, readListAppearance(JSON.stringify({ ...current, ...patch }), columns));
            setError("");
        } catch { setError("No se pudo guardar la vista de la lista en este dispositivo."); }
    }, [key, columns]);
    return { appearance, change, error };
}
