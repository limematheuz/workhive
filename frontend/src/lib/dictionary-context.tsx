"use client";

import React, {
    createContext,
    use,
    useCallback,
    useEffect,
    useMemo,
    useSyncExternalStore,
} from "react";
import en from "@/dictionaries/en.json";
import es from "@/dictionaries/es.json";

export type Dictionary = typeof en;
export type Locale = "en" | "es";

const DEFAULT_LOCALE: Locale = "es";

interface DictionaryContextType {
    dict: Dictionary;
    locale: Locale;
    setLocale: (locale: Locale) => void;
}

const LOCALE_STORAGE_KEY = "locale";

const localeListeners = new Set<() => void>();

function subscribeLocale(onStoreChange: () => void): () => void {
    localeListeners.add(onStoreChange);
    return () => localeListeners.delete(onStoreChange);
}

function notifyLocaleListeners(): void {
    localeListeners.forEach((listener) => listener());
}

function resolveLocale(stored: string | null): Locale {
    return stored === "en" ? "en" : "es";
}

function readLocaleFromStorage(): Locale {
    if (typeof window === "undefined") return DEFAULT_LOCALE;
    return resolveLocale(localStorage.getItem(LOCALE_STORAGE_KEY));
}

function getServerLocaleSnapshot(): Locale {
    return DEFAULT_LOCALE;
}

function getClientLocaleSnapshot(): Locale {
    return readLocaleFromStorage();
}

function useLocale(): [Locale, (locale: Locale) => void] {
    const locale = useSyncExternalStore(
        subscribeLocale,
        getClientLocaleSnapshot,
        getServerLocaleSnapshot
    );

    const setLocale = useCallback((newLocale: Locale) => {
        localStorage.setItem(LOCALE_STORAGE_KEY, newLocale);
        document.documentElement.lang = newLocale;
        notifyLocaleListeners();
    }, []);

    useEffect(() => {
        document.documentElement.lang = locale;
    }, [locale]);

    return [locale, setLocale];
}

const DictionaryContext = createContext<DictionaryContextType>({
    dict: es,
    locale: DEFAULT_LOCALE,
    setLocale: () => {},
});

export function DictionaryProvider({ children }: { children: React.ReactNode }) {
    const [locale, setLocale] = useLocale();
    const dict = locale === "es" ? es : en;
    const value = useMemo(
        () => ({ dict, locale, setLocale }),
        [dict, locale, setLocale]
    );

    return (
        <DictionaryContext.Provider value={value}>
            {children}
        </DictionaryContext.Provider>
    );
}

export function useDictionary() {
    return use(DictionaryContext);
}
