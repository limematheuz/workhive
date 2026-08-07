"use client";

import type { ReactNode } from "react";
import { ChevronDown } from "lucide-react";

import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";

type DocumentFormAdvancedPanelProps = {
    title: string;
    description: string;
    children: ReactNode;
    className?: string;
    defaultOpen?: boolean;
};

/** Progressive disclosure for fiscal/parties/notes blocks in document forms. */
export function DocumentFormAdvancedPanel({
    title,
    description,
    children,
    className,
    defaultOpen = false,
}: DocumentFormAdvancedPanelProps) {
    return (
        <Collapsible
            defaultOpen={defaultOpen}
            className={cn("billing-surface group rounded-[24px]", className)}
        >
            <CollapsibleTrigger className="flex w-full cursor-pointer items-center justify-between gap-3 px-4 py-3.5 text-left text-sm font-semibold text-[var(--text-main)] sm:px-5">
                <span className="min-w-0">
                    {title}
                    <span className="mt-0.5 block text-xs font-normal text-[var(--text-muted)] sm:mt-0 sm:ml-2 sm:inline">
                        {description}
                    </span>
                </span>
                <ChevronDown
                    className="h-4 w-4 shrink-0 text-[var(--text-muted)] transition-transform group-data-[state=open]:rotate-180"
                    aria-hidden="true"
                />
            </CollapsibleTrigger>
            <CollapsibleContent className="overflow-hidden data-[state=closed]:animate-none">
                <div className="space-y-5 border-t border-[var(--border-soft)] p-4 sm:p-5">
                    {children}
                </div>
            </CollapsibleContent>
        </Collapsible>
    );
}
