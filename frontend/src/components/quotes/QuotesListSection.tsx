"use client";

import { Edit3, Eye, FileText, Trash2 } from "lucide-react";

import { ActionPopover } from "@/components/ui/action-popover";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { DataTablePagination, useDataTablePagination } from "@/components/ui/data-table-pagination";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { QUOTE_STATUS_BADGE as STATUS_BADGE } from "@/lib/constants";
import { formatCurrency, formatDate, formatQuoteNumber } from "@/lib/format";
import { isQuoteContentEditable } from "@/lib/quote-editability";
import type { Quote } from "@/types/quote";

type QuotesListSectionProps = {
    quotes: Quote[];
    statusLabels: Record<string, string>;
    emptyLabel: string;
    columnLabels: {
        title: string;
        client: string;
        date: string;
        total: string;
        status: string;
        actions: string;
    };
    getClientName: (quote: Quote) => string;
    onViewQuote: (quote: Quote) => void;
    onEditQuote: (quote: Quote) => void;
    onDeleteQuote: (quoteId: number) => void;
    canManage: boolean;
};

export function QuotesListSection({
    quotes,
    statusLabels,
    emptyLabel,
    columnLabels,
    getClientName,
    onViewQuote,
    onEditQuote,
    onDeleteQuote,
    canManage,
}: QuotesListSectionProps) {
    const pagination = useDataTablePagination(quotes, 10);
    const actions = (quote: Quote) => [
        { label: "Ver", icon: Eye, onClick: () => onViewQuote(quote) },
        ...(canManage && isQuoteContentEditable(quote.status)
            ? [{ label: "Editar", icon: Edit3, onClick: () => onEditQuote(quote), variant: "edit" as const }]
            : []),
        ...(canManage
            ? [{ label: "Eliminar", icon: Trash2, onClick: () => onDeleteQuote(quote.id), variant: "delete" as const }]
            : []),
    ];

    return (
        <section className="billing-surface overflow-hidden rounded-[26px] border border-[color-mix(in_srgb,var(--border-color)_32%,transparent)]">
            <header className="px-5 py-4">
                <h2 className="text-sm font-semibold text-[var(--text-main)]">Presupuestos registrados</h2>
                <p className="mt-1 text-xs text-[var(--text-muted)]">Pulsa una fila para abrir el detalle sin pasos extra.</p>
            </header>

            {quotes.length === 0 ? (
                <div className="px-5 py-16 text-center">
                    <FileText className="mx-auto mb-3 size-10 text-[var(--text-muted)] opacity-50" />
                    <p className="text-sm font-medium text-[var(--text-muted)]">{emptyLabel}</p>
                </div>
            ) : (
                <>
                    <div className="space-y-2.5 p-3 xl:hidden">
                        {pagination.pageItems.map((quote) => (
                            <Card key={quote.id} className="min-w-0 transition hover:brightness-[0.985]">
                                <CardContent className="min-w-0 p-0">
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        onClick={() => onViewQuote(quote)}
                                        className="h-auto min-h-0 w-full min-w-0 justify-start rounded-2xl p-3 text-left hover:translate-y-0 hover:bg-transparent hover:shadow-none"
                                    >
                                        <span className="min-w-0 flex-1">
                                            <span className="flex min-w-0 items-start justify-between gap-2">
                                                <span className="min-w-0">
                                                    <span className="font-mono text-xs font-semibold text-accent">{formatQuoteNumber(quote.quote_number)}</span>
                                                    <span className="mt-1 block truncate text-sm font-semibold text-[var(--text-main)]">{quote.title}</span>
                                                </span>
                                                <span className={`shrink-0 rounded-full px-2 py-0.5 text-[9px] font-semibold uppercase ${STATUS_BADGE[quote.status] ?? STATUS_BADGE.draft}`}>
                                                    {statusLabels[quote.status] ?? quote.status}
                                                </span>
                                            </span>
                                            <span className="mt-2 flex min-w-0 justify-between gap-3 border-t border-[var(--border-soft)] pt-2 text-xs text-[var(--text-muted)]">
                                                <span className="truncate">{getClientName(quote)}</span>
                                                <span className="shrink-0 font-mono text-[var(--text-main)]">{formatCurrency(quote.total_amount)}</span>
                                            </span>
                                        </span>
                                    </Button>
                                </CardContent>
                            </Card>
                        ))}
                    </div>

                    <div className="hidden xl:block">
                        <Table className="table-fixed text-left">
                            <colgroup>
                                <col className="w-[12%]" />
                                <col className="w-[24%]" />
                                <col className="w-[20%]" />
                                <col className="w-[14%]" />
                                <col className="w-[12%]" />
                                <col className="w-[11%]" />
                                <col className="w-[7%]" />
                            </colgroup>
                            <TableHeader>
                                <TableRow className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--text-muted)]">
                                    <TableHead className="text-[var(--btn-secondary-text)]">Nº</TableHead>
                                    <TableHead className="text-[var(--btn-secondary-text)]">{columnLabels.title}</TableHead>
                                    <TableHead className="text-[var(--btn-secondary-text)]">{columnLabels.client}</TableHead>
                                    <TableHead className="text-[var(--btn-secondary-text)]">{columnLabels.date}</TableHead>
                                    <TableHead className="text-right text-[var(--btn-secondary-text)]">{columnLabels.total}</TableHead>
                                    <TableHead className="text-center text-[var(--btn-secondary-text)]">{columnLabels.status}</TableHead>
                                    <TableHead className="text-right text-[var(--btn-secondary-text)]">{columnLabels.actions}</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {pagination.pageItems.map((quote) => (
                                    <TableRow key={quote.id} onClick={() => onViewQuote(quote)} className="cursor-pointer border-b border-[var(--border-soft)] hover:bg-[var(--bg-secondary)]/55">
                                        <TableCell>
                                            <Button
                                                type="button"
                                                variant="link"
                                                onClick={(event) => {
                                                    event.stopPropagation();
                                                    onViewQuote(quote);
                                                }}
                                                className="h-auto border-0 bg-transparent p-0 font-mono text-sm font-semibold text-accent shadow-none hover:bg-transparent hover:shadow-none hover:no-underline"
                                            >
                                                {formatQuoteNumber(quote.quote_number)}
                                            </Button>
                                        </TableCell>
                                        <TableCell className="truncate font-medium text-[var(--text-main)]">{quote.title}</TableCell>
                                        <TableCell className="truncate text-sm text-[var(--text-muted)]">{getClientName(quote)}</TableCell>
                                        <TableCell className="text-sm text-[var(--text-muted)]">{formatDate(quote.created_at)}</TableCell>
                                        <TableCell className="text-right font-mono text-sm font-semibold text-[var(--text-main)]">{formatCurrency(quote.total_amount)}</TableCell>
                                        <TableCell className="text-center">
                                            <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_BADGE[quote.status] ?? STATUS_BADGE.draft}`}>
                                                {statusLabels[quote.status] ?? quote.status}
                                            </span>
                                        </TableCell>
                                        <TableCell className="text-right" onClick={(event) => event.stopPropagation()}>
                                            <ActionPopover align="end" options={actions(quote)} />
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>

                    <DataTablePagination
                        page={pagination.page}
                        totalItems={quotes.length}
                        pageSize={pagination.pageSize}
                        onPageChange={pagination.setPage}
                        onPageSizeChange={pagination.setPageSize}
                        summary={`${(pagination.page - 1) * pagination.pageSize + 1}-${Math.min(pagination.page * pagination.pageSize, quotes.length)} de ${quotes.length} presupuestos`}
                        rowsPerPageLabel="Filas por página"
                        previousLabel="Página anterior"
                        nextLabel="Página siguiente"
                    />
                </>
            )}
        </section>
    );
}
