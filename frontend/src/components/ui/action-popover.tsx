"use client";

import * as React from "react";
import Link from "next/link";
import { MoreVertical } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export interface PopoverOption {
    label: string;
    icon?: React.ComponentType<{ className?: string }>;
    onClick?: () => void;
    href?: string;
    variant?: "default" | "edit" | "delete" | "deactivate";
    disabled?: boolean;
}

interface ActionPopoverProps {
    options: PopoverOption[];
    align?: "start" | "center" | "end";
    trigger?: React.ReactNode;
    triggerLabel?: string;
    className?: string;
}

export function ActionPopover({
    options,
    align = "end",
    trigger,
    triggerLabel = "Open actions menu",
    className,
}: ActionPopoverProps) {
    return (
        <Popover>
            <PopoverTrigger asChild>
                {trigger || (
                    <button
                        type="button"
                        aria-label={triggerLabel}
                        className={cn(
                            "p-1.5 rounded-lg hover:bg-[var(--bg-tertiary)] text-[var(--text-muted)] hover:text-[var(--text-main)] transition-colors border-none bg-transparent cursor-pointer flex items-center justify-center outline-none",
                            className
                        )}
                    >
                        <MoreVertical className="w-4 h-4" />
                    </button>
                )}
            </PopoverTrigger>
            <PopoverContent align={align} className="w-40 p-1 bg-[var(--bg-card-solid)] border-[var(--border-soft)]">
                <div className="flex flex-col gap-0.5">
                    {options.map((opt) => {
                        const Icon = opt.icon;
                        const isDelete = opt.variant === "delete";
                        const isEdit = opt.variant === "edit";
                        const isDeactivate = opt.variant === "deactivate";
                        const optionKey = opt.href ?? `${opt.label}-${opt.variant ?? "default"}-${opt.disabled ? "disabled" : "enabled"}`;

                        const optionClass = cn(
                            "group flex w-full items-center gap-2 px-3 py-2 text-xs font-semibold border-none bg-transparent cursor-pointer transition-colors rounded-lg text-left no-underline select-none outline-none",
                            isDelete
                                ? "text-[var(--btn-cancel-text)] hover:bg-[var(--btn-cancel-hover-bg)] hover:text-[var(--btn-cancel-hover-text)]"
                                : isDeactivate
                                ? "text-[var(--btn-cancel-text)] hover:bg-[var(--btn-cancel-bg)]"
                                : isEdit
                                ? "text-[var(--btn-secondary-text)] hover:bg-[var(--btn-secondary-bg)]"
                                : "text-[var(--text-main)] hover:bg-[var(--bg-tertiary)]",
                            opt.disabled && "opacity-50 pointer-events-none"
                        );

                        const iconClass = cn(
                            "h-3.5 w-3.5 shrink-0",
                            isDelete
                                ? "text-[var(--btn-cancel-text)] group-hover:text-[var(--btn-cancel-hover-text)]"
                                : isDeactivate
                                ? "text-[var(--btn-cancel-text)]"
                                : isEdit
                                ? "text-[var(--btn-secondary-text)]"
                                : "text-[var(--text-muted)]"
                        );

                        const content = (
                            <>
                                {Icon && <Icon className={iconClass} />}
                                <span>{opt.label}</span>
                            </>
                        );

                        if (opt.href && !opt.disabled) {
                            return (
                                <Link key={optionKey} href={opt.href} className={optionClass}>
                                    {content}
                                </Link>
                            );
                        }

                        return (
                            <button
                                key={optionKey}
                                type="button"
                                disabled={opt.disabled}
                                onClick={opt.onClick}
                                className={optionClass}
                            >
                                {content}
                            </button>
                        );
                    })}
                </div>
            </PopoverContent>
        </Popover>
    );
}
