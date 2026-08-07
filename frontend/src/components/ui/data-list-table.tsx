"use client";

import { Loader2 } from "lucide-react";
import type { KeyboardEvent, ReactNode } from "react";

import { cn } from "@/lib/utils";

export type DataListColumn = {
    key: string;
    label: ReactNode;
    className?: string;
};

type DataListHeader = {
    title: string;
    subtitle?: string;
    countLabel?: string;
};

type DataListTableProps<T> = {
    items: T[];
    getRowKey: (item: T) => string | number;
    columns: DataListColumn[];
    /** Tailwind grid template shared by desktop header + desktop rows, e.g. `grid-cols-[1fr_1fr_auto]`. */
    gridClassName: string;
    renderDesktopRow: (item: T) => ReactNode;
    renderCompactRow: (item: T) => ReactNode;
    onRowClick?: (item: T) => void;
    rowAriaLabel?: (item: T) => string;
    header?: DataListHeader;
    empty?: ReactNode;
    loading?: boolean;
    loadingLabel?: string;
    /** When the desktop grid becomes visible. Default `md`. */
    desktopFrom?: "md" | "lg";
    /** `surface` wraps with billing-surface; `plain` is for nesting inside another panel. */
    variant?: "surface" | "plain";
    className?: string;
    /** Extra content rendered above the rows (filters, etc.). */
    toolbar?: ReactNode;
};

export function DataListRow({
    children,
    compact = false,
    gridClassName,
    onClick,
    ariaLabel,
    className,
    interactive = true,
}: {
    children: ReactNode;
    compact?: boolean;
    gridClassName?: string;
    onClick?: () => void;
    ariaLabel?: string;
    className?: string;
    interactive?: boolean;
}) {
    const openWithKeyboard = (event: KeyboardEvent<HTMLDivElement>) => {
        if (!onClick) return;
        if (event.target !== event.currentTarget && (event.target as HTMLElement).closest("button,a,input,select,textarea,[role='menuitem']")) {
            return;
        }
        if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            onClick();
        }
    };

    return (
        <div
            role={onClick && interactive ? "button" : undefined}
            tabIndex={onClick && interactive ? 0 : undefined}
            aria-label={ariaLabel}
            onClick={onClick}
            onKeyDown={onClick ? openWithKeyboard : undefined}
            className={cn(
                "billing-block rounded-2xl transition",
                onClick && interactive && "cursor-pointer hover:brightness-[0.985] active:scale-[0.995] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40",
                compact
                    ? "p-3"
                    : cn("grid items-center gap-3 px-3.5 py-2.5", gridClassName),
                className,
            )}
        >
            {children}
        </div>
    );
}

export function DataListTable<T>({
    items,
    getRowKey,
    columns,
    gridClassName,
    renderDesktopRow,
    renderCompactRow,
    onRowClick,
    rowAriaLabel,
    header,
    empty,
    loading = false,
    loadingLabel = "Cargando...",
    desktopFrom = "md",
    variant = "surface",
    className,
    toolbar,
}: DataListTableProps<T>) {
    const compactHidden = desktopFrom === "lg" ? "lg:hidden" : "md:hidden";
    const desktopHidden = desktopFrom === "lg" ? "hidden lg:block" : "hidden md:block";
    const shellClass = variant === "surface"
        ? "billing-surface overflow-hidden rounded-[26px]"
        : "overflow-hidden";

    if (loading) {
        return (
            <div className={cn(variant === "surface" && "billing-surface rounded-[26px]", "flex flex-col items-center justify-center gap-3 py-20", className)}>
                <Loader2 className="h-8 w-8 animate-spin text-accent" aria-hidden="true" />
                <span className="text-xs text-[var(--text-muted)]">{loadingLabel}</span>
            </div>
        );
    }

    return (
        <section className={cn(shellClass, className)}>
            {header && (
                <header className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <h2 className="text-sm font-semibold text-[var(--text-main)]">{header.title}</h2>
                        {header.subtitle && (
                            <p className="mt-1 text-xs text-[var(--text-muted)]">{header.subtitle}</p>
                        )}
                    </div>
                    {header.countLabel && (
                        <span className="w-fit rounded-full bg-[var(--bg-tertiary)] px-3 py-1 text-xs font-semibold text-[var(--text-main)]">
                            {header.countLabel}
                        </span>
                    )}
                </header>
            )}

            {toolbar && <div className="border-t border-[var(--border-soft)] px-3 pb-1 pt-3 sm:px-4">{toolbar}</div>}

            {items.length === 0 ? (
                <div className="px-5 py-16 text-center">
                    {empty ?? <p className="text-sm text-[var(--text-muted)]">No hay resultados.</p>}
                </div>
            ) : (
            <>
            <div className={cn("space-y-2.5", variant === "surface" ? "p-3" : "p-0", compactHidden)}>
                {items.map((item) => (
                    <DataListRow
                        key={getRowKey(item)}
                        compact
                        onClick={onRowClick ? () => onRowClick(item) : undefined}
                        ariaLabel={rowAriaLabel?.(item)}
                    >
                        {renderCompactRow(item)}
                    </DataListRow>
                ))}
            </div>

            <div className={cn("space-y-2.5", variant === "surface" ? "p-3" : "p-0", desktopHidden)}>
                <div
                    className={cn(
                        "grid gap-3 px-3.5 py-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--text-muted)]",
                        gridClassName,
                    )}
                >
                    {columns.map((column) => (
                        <span key={column.key} className={column.className}>
                            {column.label}
                        </span>
                    ))}
                </div>
                {items.map((item) => (
                    <DataListRow
                        key={getRowKey(item)}
                        gridClassName={gridClassName}
                        onClick={onRowClick ? () => onRowClick(item) : undefined}
                        ariaLabel={rowAriaLabel?.(item)}
                    >
                        {renderDesktopRow(item)}
                    </DataListRow>
                ))}
            </div>
            </>
            )}
        </section>
    );
}
