"use client";
import { useCallback, useMemo, useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";
import { browserViewStateKey } from "@/lib/view-state-storage";
import { readSavedViews, type SavedView } from "@/lib/saved-views";

const changed = "workhive:saved-views", serverSnapshot = () => null;
export function useSavedViews(viewKey: string, keys: readonly string[]) {
    const path = usePathname(), key = browserViewStateKey(path, "saved." + viewKey);
    const read = useCallback(() => { try { return localStorage.getItem(key); } catch { return null; } }, [key]);
    const subscribe = useCallback((listener: () => void) => {
        window.addEventListener(changed, listener); window.addEventListener("storage", listener);
        return () => { window.removeEventListener(changed, listener); window.removeEventListener("storage", listener); };
    }, []);
    const raw = useSyncExternalStore(subscribe, read, serverSnapshot);
    const views = useMemo(() => readSavedViews(raw, viewKey, keys), [raw, viewKey, keys]);
    const write = useCallback((next: SavedView[]) => {
        localStorage.setItem(key, JSON.stringify(next.slice(0, 20)));
        window.dispatchEvent(new Event(changed));
    }, [key]);
    return { views, write, ownerKey: key };
}
