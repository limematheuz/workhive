"use client";

import { Loader2 } from "lucide-react";
import { Children, Fragment, isValidElement, useMemo, useRef, type KeyboardEvent, type ReactNode } from "react";

import {useListScroll} from "@/hooks/useListScroll";
import { Card, CardContent } from "@/components/ui/card";
import { DataTablePagination, useDataTablePagination } from "@/components/ui/data-table-pagination";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { useListAppearance } from "@/hooks/useListAppearance";
import { orderedListItems } from "@/lib/list-appearance";
import { ListAppearanceMenu } from "@/components/ui/list-appearance-menu";

const EMPTY_SORT_OPTIONS: never[] = [];

export type DataListColumn = {
    key: string;
    label: ReactNode;
    className?: string;
    labelText?: string;
    hideable?: boolean;
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
    selectedRowKey?: string | number | null;
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
    /** False renders all supplied rows, for summaries or an upstream paginated collection. */
    pagination?: boolean;
    persistenceKey?: string;
    customizable?: boolean;
    sortOptions?: { value: string; label: string; compare: (first: T, second: T) => number }[];
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
    selectedRowKey,
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
    persistenceKey,
    customizable = false,
    sortOptions = EMPTY_SORT_OPTIONS,
}: DataListTableProps<T>) {
    const tableElement=useRef<HTMLElement|null>(null);
    const listKey=persistenceKey??("list."+(header?.title??columns.map(column=>column.key).join(".")));
    const { appearance, change, error: appearanceError } = useListAppearance(listKey, columns);
    const activeSort = customizable ? sortOptions.find(option => option.value === appearance.sort) : undefined;
    const compare = activeSort?.compare;
    const orderedItems = useMemo(() => orderedListItems(items, compare), [items, compare]);
    const hiddenColumns = new Set(appearance.hidden);
    const visibleColumns = columns.flatMap((column, index) => !customizable || !hiddenColumns.has(column.key) ? [{ column, index }] : []);
    const rememberPosition=useListScroll(listKey,!loading&&items.length>0,tableElement);
    const compactHidden = desktopFrom === "lg" ? "lg:hidden" : "md:hidden";
    const desktopHidden = desktopFrom === "lg" ? "hidden lg:block" : "hidden md:block";
    const shellClass = variant === "surface"
        ? "billing-surface overflow-hidden rounded-2xl border border-[color-mix(in_srgb,var(--border-color)_32%,transparent)]"
        : "overflow-hidden rounded-2xl border border-[color-mix(in_srgb,var(--border-color)_32%,transparent)]";
    const pagination = useDataTablePagination(orderedItems, 10, listKey);
    const pageItems = showPagination ? pagination.pageItems : orderedItems;
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
        <section ref={tableElement} data-list-density={customizable ? appearance.density : undefined} onClickCapture={event=>{if((event.target as HTMLElement).closest("a[href]"))rememberPosition();}} onKeyDownCapture={event=>{if(event.key==="Enter"&&(event.target as HTMLElement).closest("a[href]"))rememberPosition();}} className={cn(shellClass, className)}>
            {header && (
                <header className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <h2 className="text-sm font-semibold text-[var(--text-main)]">{header.title}</h2>
                        {header.subtitle && (
                            <p className="mt-1 text-xs text-[var(--text-muted)]">{header.subtitle}</p>
                        )}
                    </div>
                    <div className="flex items-center gap-2">{header.countLabel && (
                        <span className="w-fit rounded-full bg-[var(--bg-tertiary)] px-3 py-1 text-xs font-semibold text-[var(--text-main)]">
                            {header.countLabel}
                        </span>
                    )}{customizable && <ListAppearanceMenu columns={columns} appearance={appearance} change={change} sortOptions={sortOptions} />}</div>
                </header>
            )}
            {!header && customizable && <div className="flex justify-end px-3 py-2"><ListAppearanceMenu columns={columns} appearance={appearance} change={change} sortOptions={sortOptions} /></div>}
            {customizable && appearanceError && <p role="status" className="px-4 pb-2 text-xs text-orange-700">{appearanceError}</p>}

            {toolbar && <div className="border-t border-[var(--table-divider)] px-4 py-3 sm:px-4">{toolbar}</div>}

            {items.length === 0 ? (
                <div className="px-4 py-10 text-center">
                    {empty ?? <p className="text-sm text-[var(--text-muted)]">No hay resultados.</p>}
                </div>
            ) : (
            <>
            <div className={cn("space-y-2.5", variant === "surface" ? "p-3" : "", compactHidden)}>
                {pageItems.map((item) => (
                    <DataListRow
                        key={getRowKey(item)}
                        compact
                        onClick={onRowClick ? () => {rememberPosition();onRowClick(item);} : undefined}
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
                            {visibleColumns.map(({ column }) => (
                                <TableHead key={column.key} className={cn("bg-muted/50 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-accent", column.className)}>
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
                                    aria-selected={selectedRowKey == null ? undefined : getRowKey(item) === selectedRowKey}
                                    className={cn(interactive && "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40", getRowKey(item) === selectedRowKey && "wh-selected-row")}
                                    onClick={onRowClick ? () => {rememberPosition();onRowClick(item);} : undefined}
                                    onKeyDown={openWithKeyboard}
                                    tabIndex={interactive ? 0 : undefined}
                                    aria-label={rowAriaLabel?.(item)}
                                >
                                    {visibleColumns.map(({ column, index }) => (
                                        <TableCell key={column.key} className={cn("min-w-0 whitespace-normal break-words px-3 py-2.5", customizable && appearance.density === "compact" && "py-1.5 text-xs", column.className)}>
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
