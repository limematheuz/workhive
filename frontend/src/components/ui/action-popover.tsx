"use client";

import * as React from "react";
import Link from "next/link";
import { MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
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
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                {trigger || (
                    <Button
                        type="button"
                        aria-label={triggerLabel}
                        variant="ghost"
                        size="icon-xs"
                        className={cn(
                            "border-0 bg-transparent text-[var(--text-muted)] shadow-none hover:bg-transparent hover:text-[var(--text-main)] hover:shadow-none",
                            className
                        )}
                    >
                        <MoreHorizontal className="w-4 h-4" />
                    </Button>
                )}
            </DropdownMenuTrigger>
            <DropdownMenuContent align={align} className="w-40">
                    {options.map((opt) => {
                        const Icon = opt.icon;
                        const isDelete = opt.variant === "delete";
                        const isDeactivate = opt.variant === "deactivate";
                        const optionKey = opt.href ?? `${opt.label}-${opt.variant ?? "default"}-${opt.disabled ? "disabled" : "enabled"}`;

                        const actionClass = isDelete || isDeactivate
                            ? "text-[var(--btn-cancel-text)] data-[highlighted]:!bg-[var(--btn-cancel-bg)] data-[highlighted]:!text-[var(--btn-cancel-text)]"
                            : "text-[var(--btn-secondary-text)] data-[highlighted]:!bg-[var(--btn-secondary-bg)] data-[highlighted]:!text-[var(--btn-secondary-text)]";
                        const iconClass = cn(
                            "h-3.5 w-3.5 shrink-0 transition-colors",
                            isDelete || isDeactivate
                                ? "text-[var(--btn-cancel-text)] group-data-[highlighted]/action:!text-[var(--btn-cancel-text)]"
                                : "text-[var(--btn-secondary-text)] group-data-[highlighted]/action:!text-[var(--btn-secondary-text)]",
                        );

                        const content = (
                            <>
                                {Icon && <Icon className={iconClass} />}
                                <span>{opt.label}</span>
                            </>
                        );

                        if (opt.href && !opt.disabled) {
                            return (
                                <DropdownMenuItem key={optionKey} className={cn("group/action", actionClass)} asChild>
                                    <Link href={opt.href}>{content}</Link>
                                </DropdownMenuItem>
                            );
                        }

                        return (
                            <React.Fragment key={optionKey}>
                            {isDelete && <DropdownMenuSeparator />}
                            <DropdownMenuItem
                                disabled={opt.disabled}
                                onClick={opt.onClick}
                                className={cn("group/action", actionClass)}
                            >
                                {content}
                            </DropdownMenuItem>
                            </React.Fragment>
                        );
                    })}
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
