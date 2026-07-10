"use client";

import { parseInstructionContent } from "@/lib/format";

interface InstructionListProps {
    description?: string | null;
    showSummary?: boolean;
    maxItems?: number;
    emptyText?: string;
    className?: string;
}

export function InstructionList({
    description,
    showSummary = true,
    maxItems,
    emptyText,
    className = "",
}: InstructionListProps) {
    const { summary, items } = parseInstructionContent(description);
    const visibleItems = maxItems ? items.slice(0, maxItems) : items;
    const remaining = maxItems ? Math.max(0, items.length - maxItems) : 0;
    const shouldShowSummary = showSummary || items.length === 0;

    if (!summary && items.length === 0) {
        return emptyText ? (
            <p className={`text-sm font-medium text-[var(--text-muted)] ${className}`}>
                {emptyText}
            </p>
        ) : null;
    }

    return (
        <div className={`space-y-3 ${className}`}>
            {shouldShowSummary && summary && (
                <p className="text-sm font-medium leading-6 text-[var(--text-muted)]">
                    {summary}
                </p>
            )}
            {visibleItems.length > 0 && (
                <ol className="space-y-2">
                    {visibleItems.map((item, index) => (
                        <li
                            key={item}
                            className="flex max-w-full items-start gap-3 rounded-lg border border-[var(--border-soft)] bg-[var(--bg-secondary)] px-3 py-2 text-sm font-semibold leading-5 text-[var(--text-main)]"
                        >
                            <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-accent text-[11px] font-black text-white">
                                {index + 1}
                            </span>
                            <span className="break-words">{item}</span>
                        </li>
                    ))}
                    {remaining > 0 && (
                        <li className="inline-flex items-center rounded-lg border border-[var(--border-soft)] bg-[var(--bg-secondary)] px-3 py-2 text-sm font-bold text-[var(--text-muted)]">
                            +{remaining} más
                        </li>
                    )}
                </ol>
            )}
        </div>
    );
}
