"use client";

import { Edit3, Eye, FileText, Trash2 } from "lucide-react";

import { ActionPopover } from "@/components/ui/action-popover";
import { DataListTable } from "@/components/ui/data-list-table";
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
};

const GRID =
    "grid-cols-[minmax(8rem,.9fr)_minmax(12rem,1.3fr)_minmax(8rem,1fr)_minmax(7rem,.7fr)_minmax(7rem,.7fr)_7.5rem_5.5rem]";

export function QuotesListSection({
    quotes,
    statusLabels,
    emptyLabel,
    columnLabels,
    getClientName,
    onViewQuote,
    onEditQuote,
    onDeleteQuote,
}: QuotesListSectionProps) {
    const getQuoteActions = (quote: Quote) => [
        {
            label: "Ver",
            icon: Eye,
            onClick: () => onViewQuote(quote),
        },
        ...(isQuoteContentEditable(quote.status)
            ? [{
                label: "Editar",
                icon: Edit3,
                onClick: () => onEditQuote(quote),
                variant: "edit" as const,
            }]
            : []),
        {
            label: "Eliminar",
            icon: Trash2,
            onClick: () => onDeleteQuote(quote.id),
            variant: "delete" as const,
        },
    ];

    return (
        <DataListTable
            items={quotes}
            getRowKey={(quote) => quote.id}
            gridClassName={GRID}
            desktopFrom="lg"
            onRowClick={onViewQuote}
            rowAriaLabel={(quote) => `Abrir presupuesto ${formatQuoteNumber(quote.quote_number)}`}
            header={{
                title: "Presupuestos registrados",
                subtitle: "Pulsa una fila para abrir el detalle sin pasos extra.",
                countLabel: `${quotes.length} ${quotes.length === 1 ? "presupuesto" : "presupuestos"}`,
            }}
            columns={[
                { key: "number", label: "Nº" },
                { key: "title", label: columnLabels.title },
                { key: "client", label: columnLabels.client },
                { key: "date", label: columnLabels.date },
                { key: "total", label: columnLabels.total, className: "text-right" },
                { key: "status", label: columnLabels.status, className: "text-center" },
                { key: "actions", label: columnLabels.actions, className: "text-right" },
            ]}
            empty={(
                <>
                    <FileText className="mx-auto mb-3 h-10 w-10 text-[var(--text-muted)] opacity-50" aria-hidden="true" />
                    <p className="text-sm font-medium text-[var(--text-muted)]">{emptyLabel}</p>
                </>
            )}
            renderCompactRow={(quote) => (
                <>
                    <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                                <span className="font-mono text-xs font-semibold text-accent">{formatQuoteNumber(quote.quote_number)}</span>
                                <span className={`inline-block rounded-full px-2 py-0.5 text-[9px] font-semibold uppercase ${STATUS_BADGE[quote.status] ?? STATUS_BADGE.draft}`}>
                                    {statusLabels[quote.status] ?? quote.status}
                                </span>
                            </div>
                            <span className="mt-1 block truncate text-sm font-semibold text-[var(--text-main)]">{quote.title}</span>
                        </div>
                        <div onClick={(e) => e.stopPropagation()}>
                            <ActionPopover align="end" options={getQuoteActions(quote)} />
                        </div>
                    </div>
                    <div className="mt-2.5 space-y-1.5 border-t border-[var(--border-soft)] pt-2.5">
                        <div className="flex items-center justify-between text-xs">
                            <span className="font-medium text-[var(--text-muted)]">{getClientName(quote)}</span>
                            <span className="text-[var(--text-muted)]">{formatDate(quote.created_at)}</span>
                        </div>
                        <div className="flex items-center justify-end">
                            <span className="text-sm font-semibold text-[var(--text-main)]">{formatCurrency(quote.total_amount)}</span>
                        </div>
                    </div>
                </>
            )}
            renderDesktopRow={(quote) => (
                <>
                    <button
                        type="button"
                        onClick={(event) => {
                            event.stopPropagation();
                            onViewQuote(quote);
                        }}
                        className="truncate text-left font-mono text-sm font-semibold text-accent hover:underline"
                    >
                        {formatQuoteNumber(quote.quote_number)}
                    </button>
                    <p className="truncate text-sm font-medium text-[var(--text-main)]">{quote.title}</p>
                    <p className="truncate text-sm text-[var(--text-muted)]">{getClientName(quote)}</p>
                    <p className="text-sm text-[var(--text-muted)]">{formatDate(quote.created_at)}</p>
                    <p className="text-right font-mono text-sm font-semibold text-[var(--text-main)]">{formatCurrency(quote.total_amount)}</p>
                    <div className="text-center">
                        <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_BADGE[quote.status] ?? STATUS_BADGE.draft}`}>
                            {statusLabels[quote.status] ?? quote.status}
                        </span>
                    </div>
                    <div className="flex justify-end" onClick={(e) => e.stopPropagation()}>
                        <ActionPopover align="end" options={getQuoteActions(quote)} />
                    </div>
                </>
            )}
        />
    );
}
