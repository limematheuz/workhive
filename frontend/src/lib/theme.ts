"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";

export type ThemeMode = "dark" | "light";

export const DEFAULT_THEME: ThemeMode = "light";

const THEME_STORAGE_KEY = "theme";

export function resolveTheme(stored: string | null): ThemeMode {
    if (stored === "dark" || stored === "light") return stored;
    if (typeof window !== "undefined" && window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches) {
        return "dark";
    }
    return DEFAULT_THEME;
}

export function readThemeFromStorage(): ThemeMode {
    if (typeof window === "undefined") return DEFAULT_THEME;
    return resolveTheme(localStorage.getItem(THEME_STORAGE_KEY));
}

export function applyTheme(theme: ThemeMode): void {
    if (typeof document === "undefined") return;
    const isLight = theme === "light";
    document.documentElement.classList.toggle("light-mode", isLight);
    document.body.classList.toggle("light-mode", isLight);
}

const themeListeners = new Set<() => void>();

function subscribeTheme(onStoreChange: () => void): () => void {
    themeListeners.add(onStoreChange);
    return () => themeListeners.delete(onStoreChange);
}

function notifyThemeListeners(): void {
    themeListeners.forEach((listener) => listener());
}

function getServerThemeSnapshot(): ThemeMode {
    return DEFAULT_THEME;
}

function getClientThemeSnapshot(): ThemeMode {
    return readThemeFromStorage();
}

export function persistTheme(theme: ThemeMode): void {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
    applyTheme(theme);
    notifyThemeListeners();
}

export function useThemeMode(): [ThemeMode, (theme: ThemeMode) => void] {
    const theme = useSyncExternalStore(
        subscribeTheme,
        getClientThemeSnapshot,
        getServerThemeSnapshot
    );

    const setTheme = useCallback((next: ThemeMode) => {
        persistTheme(next);
    }, []);

    useEffect(() => {
        applyTheme(theme);
    }, [theme]);

    return [theme, setTheme];
}

/** Mounts the theme hook at the root to apply the body class on each refresh. */
export function ThemeSync() {
    useThemeMode();
    return null;
}
