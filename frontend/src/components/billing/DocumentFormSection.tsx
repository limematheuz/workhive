import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

type DocumentFormSectionProps = {
    title: string;
    description: string;
    children: ReactNode;
    className?: string;
};

/** Reusable information group for the quote and invoice creation forms. */
export function DocumentFormSection({
    title,
    description,
    children,
    className,
}: DocumentFormSectionProps) {
    return (
        <section className={cn("@container billing-surface w-full min-w-0 rounded-[24px] p-4 sm:p-5", className)}>
            <header className="mb-4">
                <h3 className="text-sm font-semibold text-[var(--text-main)]">{title}</h3>
                <p className="mt-1 text-xs leading-5 text-[var(--text-muted)]">{description}</p>
            </header>
            {children}
        </section>
    );
}
