import type { ComponentType, ReactNode } from "react";

import { cn } from "@/lib/utils";

type PageHeaderProps = {
    icon: ComponentType<{ className?: string }>;
    title: string;
    subtitle?: string;
    actions?: ReactNode;
    className?: string;
    titleAs?: "h1" | "h2";
};

/**
 * Shared page identity, context and primary action.
 */
export function PageHeader({
    icon: Icon,
    title,
    subtitle,
    actions,
    className,
    titleAs = "h1",
}: PageHeaderProps) {
    const TitleTag = titleAs;

    return (
        <header
            className={cn(
                "wh-page-header flex min-w-0 max-w-full flex-col gap-3 border-b border-[var(--border-color)] pb-3 sm:flex-row sm:items-center sm:justify-between",
                className,
            )}
        >
            <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-[var(--brand-blue-border)] bg-[var(--brand-blue-soft)] text-accent">
                    <Icon className="h-5 w-5" aria-hidden="true" />
                </div>
                <div className="min-w-0">
                    <TitleTag className="text-2xl font-semibold leading-8 tracking-tight sm:text-[28px] sm:leading-9 text-[var(--text-main)] [overflow-wrap:anywhere]">
                        {title}
                    </TitleTag>
                    {subtitle ? (
                        <p className="mt-1 text-sm leading-5 text-[var(--text-muted)] [overflow-wrap:anywhere]">
                            {subtitle}
                        </p>
                    ) : null}
                </div>
            </div>
            {actions ? (
                <div className="flex w-full min-w-0 max-w-full shrink-0 flex-wrap items-center gap-2 sm:w-auto">
                    {actions}
                </div>
            ) : null}
        </header>
    );
}
