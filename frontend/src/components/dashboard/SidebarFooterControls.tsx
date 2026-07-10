"use client";

type SidebarFooterControlsProps = {
    isOpen: boolean;
    theme: "dark" | "light";
    locale: string;
    logoutLabel: string;
    onThemeChange: (theme: "dark" | "light") => void;
    onLocaleChange: (locale: "en" | "es") => void;
    onLogout: () => void;
};

export function SidebarFooterControls({
    isOpen,
    theme,
    locale,
    logoutLabel,
    onThemeChange,
    onLocaleChange,
    onLogout,
}: SidebarFooterControlsProps) {
    return (
        <div className="p-2 flex flex-col gap-2 mb-1 flex-shrink-0 border-t border-[var(--border-soft)] bg-transparent text-[13px]">
            {isOpen && (
                <div className="flex flex-row flex-wrap gap-2 items-center pl-1">
                    <div
                        className="flex items-center rounded-full p-1 w-fit transition-colors"
                        style={{ backgroundColor: "var(--pill-bg)" }}
                    >
                        <button
                            type="button"
                            onClick={() => onThemeChange("light")}
                            aria-label="Activar modo claro"
                            className={`flex items-center justify-center w-8 h-8 rounded-full transition-all ${
                                theme === "light" ? "" : "text-[var(--text-muted)] hover:text-[var(--text-main)]"
                            }`}
                            style={theme === "light" ? { backgroundColor: "var(--pill-active)", color: "var(--pill-active-text)" } : {}}
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                            </svg>
                        </button>
                        <button
                            type="button"
                            onClick={() => onThemeChange("dark")}
                            aria-label="Activar modo oscuro"
                            className={`flex items-center justify-center w-8 h-8 rounded-full transition-all ${
                                theme === "dark" ? "" : "text-[var(--text-muted)] hover:text-[var(--text-main)]"
                            }`}
                            style={theme === "dark" ? { backgroundColor: "var(--pill-active)", color: "var(--pill-active-text)" } : {}}
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                            </svg>
                        </button>
                    </div>

                    <div
                        className="flex items-center rounded-full p-1 w-fit transition-colors"
                        style={{ backgroundColor: "var(--pill-bg)" }}
                    >
                        <button
                            type="button"
                            onClick={() => onLocaleChange("en")}
                            aria-label="Cambiar idioma a inglés"
                            className={`flex items-center justify-center w-8 h-8 rounded-full font-semibold text-xs transition-all ${
                                locale === "en" ? "" : "text-[var(--text-muted)] hover:text-[var(--text-main)]"
                            }`}
                            style={locale === "en" ? { backgroundColor: "var(--pill-active)", color: "var(--pill-active-text)" } : {}}
                        >
                            EN
                        </button>
                        <button
                            type="button"
                            onClick={() => onLocaleChange("es")}
                            aria-label="Cambiar idioma a español"
                            className={`flex items-center justify-center w-8 h-8 rounded-full font-semibold text-xs transition-all ${
                                locale === "es" ? "" : "text-[var(--text-muted)] hover:text-[var(--text-main)]"
                            }`}
                            style={locale === "es" ? { backgroundColor: "var(--pill-active)", color: "var(--pill-active-text)" } : {}}
                        >
                            ES
                        </button>
                    </div>
                </div>
            )}

            <button
                type="button"
                onClick={onLogout}
                className="flex items-center gap-2 px-2 py-2 w-full text-left rounded-lg text-[var(--text-muted)] hover:text-[var(--btn-cancel-text)] hover:bg-[var(--btn-cancel-bg)] transition-colors"
            >
                <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                {isOpen && <span>{logoutLabel}</span>}
            </button>
        </div>
    );
}
