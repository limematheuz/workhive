import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type AuthGlassCardProps = {
    children: ReactNode;
    className?: string;
};

/** Frosted card chrome aligned with dashboard glass sheets. */
export function AuthGlassCard({ children, className }: AuthGlassCardProps) {
    return (
        <div
            className={cn(
                "relative overflow-visible rounded-[1.75rem] border border-[var(--glass-sheet-border)] bg-[var(--glass-sheet-bg)] p-6 shadow-[var(--glass-sheet-shadow)] backdrop-blur-2xl sm:p-8",
                className,
            )}
        >
            <div
                className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-[var(--glass-sheet-highlight)] to-transparent"
                aria-hidden
            />
            {children}
        </div>
    );
}
