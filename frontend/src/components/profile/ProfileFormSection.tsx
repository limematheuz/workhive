import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

type ProfileFormSectionProps = {
    title: string;
    description?: string;
    children: ReactNode;
    className?: string;
    headerExtra?: ReactNode;
};

/** Nested group inside the account-settings billing surface — quieter than nested billing-surface. */
export function ProfileFormSection({
    title,
    description,
    children,
    className,
    headerExtra,
}: ProfileFormSectionProps) {
    return (
        <section className={cn("billing-block rounded-2xl p-3.5 sm:p-4", className)}>
            <header className="mb-3 flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <h3 className="text-sm font-semibold text-[var(--text-main)]">{title}</h3>
                    {description ? (
                        <p className="mt-0.5 text-xs leading-5 text-[var(--text-muted)]">{description}</p>
                    ) : null}
                </div>
                {headerExtra}
            </header>
            {children}
        </section>
    );
}
