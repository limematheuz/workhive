"use client";

import { useDictionary } from "@/lib/dictionary-context";

interface AuthTopControlsProps {
    theme?: "dark" | "light";
    onThemeChange?: (theme: "dark" | "light") => void;
    showThemeToggle?: boolean;
}

export function AuthTopControls({ theme, onThemeChange, showThemeToggle = true }: AuthTopControlsProps) {
    const { locale, setLocale } = useDictionary();

    return (
        <div className="absolute right-3 top-3 z-20 flex max-w-[calc(100%-1.5rem)] flex-wrap items-center justify-end gap-2 sm:right-6 sm:top-6 sm:gap-3">
            {/* Theme toggle */}
            {showThemeToggle && theme && onThemeChange && (
                <div
                    className="flex items-center rounded-full p-1 w-fit transition-colors"
                    style={{ backgroundColor: "var(--pill-bg)" }}
                >
                    <button
                        onClick={() => onThemeChange("light")}
                        type="button"
                        className={`flex items-center justify-center w-8 h-8 rounded-full ui-motion ${
                            theme === "light"
                                ? "shadow-sm"
                                : "text-[var(--text-muted)] hover:text-[var(--text-main)]"
                        }`}
                        style={
                            theme === "light"
                                ? {
                                      backgroundColor: "var(--pill-active)",
                                      color: "var(--pill-active-text)",
                                  }
                                : {}
                        }
                        aria-label="Light theme"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"
                            />
                        </svg>
                    </button>
                    <button
                        onClick={() => onThemeChange("dark")}
                        type="button"
                        className={`flex items-center justify-center w-8 h-8 rounded-full ui-motion ${
                            theme === "dark"
                                ? "shadow-sm"
                                : "text-[var(--text-muted)] hover:text-[var(--text-main)]"
                        }`}
                        style={
                            theme === "dark"
                                ? {
                                      backgroundColor: "var(--pill-active)",
                                      color: "var(--pill-active-text)",
                                  }
                                : {}
                        }
                        aria-label="Dark theme"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"
                            />
                        </svg>
                    </button>
                </div>
            )}

            {/* Language toggle */}
            <div
                className="flex items-center rounded-full p-1 w-fit transition-colors"
                style={{ backgroundColor: "var(--pill-bg)" }}
            >
                <button
                    onClick={() => setLocale("en")}
                    type="button"
                    aria-label={locale === "es" ? "Cambiar idioma a inglés" : "Switch language to English"}
                    className={`flex items-center justify-center w-8 h-8 rounded-full font-semibold text-xs ui-motion ${
                        locale === "en"
                            ? "shadow-sm text-[var(--pill-active-text)]"
                            : "text-[var(--text-muted)] hover:text-[var(--text-main)]"
                    }`}
                    style={
                        locale === "en"
                            ? {
                                  backgroundColor: "var(--pill-active)",
                                  color: "var(--pill-active-text)",
                              }
                            : {}
                    }
                >
                    EN
                </button>
                <button
                    onClick={() => setLocale("es")}
                    type="button"
                    aria-label={locale === "es" ? "Cambiar idioma a español" : "Switch language to Spanish"}
                    className={`flex items-center justify-center w-8 h-8 rounded-full font-semibold text-xs ui-motion ${
                        locale === "es"
                            ? "shadow-sm text-[var(--pill-active-text)]"
                            : "text-[var(--text-muted)] hover:text-[var(--text-main)]"
                    }`}
                    style={
                        locale === "es"
                            ? {
                                  backgroundColor: "var(--pill-active)",
                                  color: "var(--pill-active-text)",
                              }
                            : {}
                    }
                >
                    ES
                </button>
            </div>
        </div>
    );
}
