"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { AuthTopControls } from "@/components/auth/AuthTopControls";
import { useDictionary } from "@/lib/dictionary-context";
import { useThemeMode } from "@/lib/theme";
import { cn } from "@/lib/utils";

type AuthShellProps = {
    children: ReactNode;
    className?: string;
    contentClassName?: string;
    showFooter?: boolean;
    /** Wider footer/content container for split layouts */
    wide?: boolean;
};

export function AuthShell({
    children,
    className,
    contentClassName,
    showFooter = true,
    wide = false,
}: AuthShellProps) {
    const { dict } = useDictionary();
    const t = dict.auth;
    const [theme, setTheme] = useThemeMode();
    const maxWidth = wide ? "max-w-6xl" : "max-w-xl";

    return (
        <main
            className={cn(
                "relative flex min-h-dvh w-full min-w-0 flex-col items-center overflow-x-hidden bg-[var(--bg-primary)] pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))] pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(4.75rem,calc(env(safe-area-inset-top)+3.25rem))] text-[var(--text-main)] transition-colors duration-300 sm:pl-[max(1.5rem,env(safe-area-inset-left))] sm:pr-[max(1.5rem,env(safe-area-inset-right))] sm:pt-[max(4rem,calc(env(safe-area-inset-top)+2.5rem))] md:pl-[max(2rem,env(safe-area-inset-left))] md:pr-[max(2rem,env(safe-area-inset-right))]",
                className,
            )}
        >
            <div className="dashboard-shell-backlight pointer-events-none absolute inset-0" aria-hidden />
            <AuthTopControls theme={theme} onThemeChange={setTheme} showThemeToggle />

            <div className={cn("relative z-10 flex w-full min-w-0 flex-1 flex-col", maxWidth, contentClassName)}>
                {children}
            </div>

            {showFooter && (
                <footer
                    className={cn(
                        "relative z-10 mt-6 flex w-full flex-col items-center justify-between gap-4 border-t border-[var(--border-soft)]/80 pt-4 text-center text-xs text-[var(--text-muted)] sm:mt-8 sm:flex-row sm:pt-5 sm:text-left",
                        maxWidth,
                    )}
                >
                    <p className="min-w-0">
                        &copy; {new Date().getFullYear()} WorkHive. {t.rights_reserved}
                    </p>
                    <nav className="flex flex-wrap justify-center gap-x-5 gap-y-2 sm:justify-end">
                        <Link href="/contact" className="hover:text-[var(--text-main)] ui-motion">
                            {t.contact_link}
                        </Link>
                        <Link href="/terms" className="hover:text-[var(--text-main)] ui-motion">
                            {t.terms_link}
                        </Link>
                        <Link href="/privacy" className="hover:text-[var(--text-main)] ui-motion">
                            {t.privacy_link}
                        </Link>
                    </nav>
                </footer>
            )}
        </main>
    );
}
