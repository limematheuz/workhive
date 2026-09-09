"use client";

import { Loader2 } from "lucide-react";
import { Children, Fragment, isValidElement, type KeyboardEvent, type ReactNode } from "react";

import { Card, CardContent } from "@/components/ui/card";
import { DataTablePagination, useDataTablePagination } from "@/components/ui/data-table-pagination";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
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
    /** Pagination or other controls rendered below both desktop and compact rows. */
    footer?: ReactNode;
    /** Disable the shared footer only for compact status summaries, not data lists. */
    pagination?: boolean;
};

export function DataListRow({
    children,
    compact = false,
    onClick,
    ariaLabel,
    className,
    interactive = true,
}: {
    children: ReactNode;
    compact?: boolean;
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
        <Card
            role={onClick && interactive ? "button" : undefined}
            tabIndex={onClick && interactive ? 0 : undefined}
            aria-label={ariaLabel}
            onClick={onClick}
            onKeyDown={onClick ? openWithKeyboard : undefined}
            className={cn(
                "transition-colors",
                onClick && interactive && "cursor-pointer hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40",
                className,
            )}
        >
            <CardContent className={cn(compact ? "p-3" : "p-4")}>{children}</CardContent>
        </Card>
    );
}

function flattenDesktopCells(node: ReactNode): ReactNode[] {
    if (Array.isArray(node)) {
        return node.flatMap(flattenDesktopCells);
    }
    if (isValidElement<{ children?: ReactNode }>(node) && node.type === Fragment) {
        return Children.toArray(node.props.children).flatMap(flattenDesktopCells);
    }
    return [node];
}

export function DataListTable<T>({
    items,
    getRowKey,
    columns,
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
    footer,
    pagination: showPagination = true,
}: DataListTableProps<T>) {
    const compactHidden = desktopFrom === "lg" ? "lg:hidden" : "md:hidden";
    const desktopHidden = desktopFrom === "lg" ? "hidden lg:block" : "hidden md:block";
    const shellClass = variant === "surface"
        ? "billing-surface overflow-hidden rounded-2xl border border-[color-mix(in_srgb,var(--border-color)_32%,transparent)]"
        : "overflow-hidden rounded-2xl border border-[color-mix(in_srgb,var(--border-color)_32%,transparent)]";
    const pagination = useDataTablePagination(items, 10);
    const pageItems = pagination.pageItems;
    const defaultFooter = showPagination ? (
        <DataTablePagination
            page={pagination.page}
            totalItems={items.length}
            pageSize={pagination.pageSize}
            onPageChange={pagination.setPage}
            onPageSizeChange={pagination.setPageSize}
            summary={`${items.length === 0 ? 0 : (pagination.page - 1) * pagination.pageSize + 1}-${Math.min(pagination.page * pagination.pageSize, items.length)} de ${items.length} resultados`}
            rowsPerPageLabel="Filas por página"
            previousLabel="Página anterior"
            nextLabel="Página siguiente"
        />
    ) : null;

    if (loading) {
        return (
            <div className={cn(variant === "surface" && "billing-surface rounded-2xl border border-[color-mix(in_srgb,var(--border-color)_32%,transparent)]", "flex flex-col items-center justify-center gap-3 py-20", className)}>
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

            {toolbar && <div className="border-t border-[var(--table-divider)] px-4 py-3 sm:px-5">{toolbar}</div>}

            {items.length === 0 ? (
                <div className="px-5 py-16 text-center">
                    {empty ?? <p className="text-sm text-[var(--text-muted)]">No hay resultados.</p>}
                </div>
            ) : (
            <>
            <div className={cn("space-y-2.5", variant === "surface" ? "p-3" : "", compactHidden)}>
                {pageItems.map((item) => (
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

            <div className={desktopHidden}>
                <Table className="table-fixed">
                    <TableHeader>
                        <TableRow className="hover:bg-transparent">
                            {columns.map((column) => (
                                <TableHead key={column.key} className={cn("bg-muted/50 px-4 py-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-accent", column.className)}>
                                    {column.label}
                                </TableHead>
                            ))}
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {pageItems.map((item) => {
                            const interactive = Boolean(onRowClick);
                            const desktopCells = flattenDesktopCells(renderDesktopRow(item));
                            const openWithKeyboard = (event: KeyboardEvent<HTMLTableRowElement>) => {
                                if (!onRowClick) return;
                                if (event.target !== event.currentTarget && (event.target as HTMLElement).closest("button,a,input,select,textarea,[role='menuitem']")) {
                                    return;
                                }
                                if (event.key === "Enter" || event.key === " ") {
                                    event.preventDefault();
                                    onRowClick(item);
                                }
                            };

                            return (
                                <TableRow
                                    key={getRowKey(item)}
                                    className={cn(interactive && "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40")}
                                    onClick={onRowClick ? () => onRowClick(item) : undefined}
                                    onKeyDown={openWithKeyboard}
                                    tabIndex={interactive ? 0 : undefined}
                                    aria-label={rowAriaLabel?.(item)}
                                >
                                    {columns.map((column, index) => (
                                        <TableCell key={column.key} className={cn("min-w-0 overflow-hidden px-4 py-3", column.className)}>
                                            {desktopCells[index]}
                                        </TableCell>
                                    ))}
                                </TableRow>
                            );
                        })}
                    </TableBody>
                </Table>
            </div>
            </>
            )}
            {footer ?? defaultFooter}
        </section>
    );
}
