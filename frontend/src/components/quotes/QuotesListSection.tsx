"use client";

import Link from "next/link";
import { Edit3, Eye, FileText, Trash2 } from "lucide-react";

import { ActionPopover } from "@/components/ui/action-popover";
import { QUOTE_STATUS_BADGE as STATUS_BADGE } from "@/lib/constants";
import { formatCurrency, formatDate, formatQuoteNumber } from "@/lib/format";
import type { Quote } from "@/types/quote";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";

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
    onDeleteQuote: (quoteId: number) => void;
};

export function QuotesListSection({
    quotes,
    statusLabels,
    emptyLabel,
    columnLabels,
    getClientName,
    onViewQuote,
    onDeleteQuote,
}: QuotesListSectionProps) {
    const getQuoteActions = (quote: Quote) => [
        {
            label: "Ver",
            icon: Eye,
            href: `/dashboard/quotes/${quote.id}`,
        },
        ...(quote.status === "draft"
            ? [{
                label: "Editar",
                icon: Edit3,
                href: `/dashboard/quotes/${quote.id}?edit=true`,
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

    if (quotes.length === 0) {
        return (
            <div className="text-center py-20 bg-[var(--bg-card)] rounded-2xl border border-[var(--border-soft)]">
                <FileText className="w-10 h-10 text-[var(--text-muted)] mx-auto mb-3 opacity-50" />
                <p className="text-sm text-[var(--text-muted)] font-medium">{emptyLabel}</p>
            </div>
        );
    }

    return (
        <>
            <div className="lg:hidden space-y-3">
                {quotes.map((quote) => (
                    <div
                        key={quote.id}
                        role="button"
                        tabIndex={0}
                        aria-label={`Open quote ${formatQuoteNumber(quote.quote_number)}`}
                        onClick={() => onViewQuote(quote)}
                        onKeyDown={(event) => {
                            if (event.target !== event.currentTarget) return;
                            if (event.key === "Enter" || event.key === " ") {
                                if (event.key === " ") event.preventDefault();
                                onViewQuote(quote);
                            }
                        }}
                        className="bg-[var(--bg-card)] border border-[var(--border-soft)] rounded-2xl p-4 space-y-3 cursor-pointer hover:border-[var(--border-color)] transition-colors shadow-sm active:scale-[0.99]"
                    >
                        <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                    <span className="text-xs font-mono font-bold text-accent">{formatQuoteNumber(quote.quote_number)}</span>
                                    <span className={`inline-block px-2 py-0.5 rounded-full text-[9px] font-bold uppercase ${STATUS_BADGE[quote.status] ?? STATUS_BADGE.draft}`}>
                                        {statusLabels[quote.status] ?? quote.status}
                                    </span>
                                </div>
                                <span className="text-sm font-black text-[var(--text-main)] mt-1 block truncate">
                                    {quote.title}
                                </span>
                            </div>
                            <div onClick={(e) => e.stopPropagation()}>
                                <ActionPopover align="end" options={getQuoteActions(quote)} />
                            </div>
                        </div>
                        <div className="space-y-1.5 pt-2 border-t border-[var(--border-soft)]/50">
                            <div className="flex items-center justify-between text-xs">
                                <span className="text-[var(--text-muted)] font-medium">{getClientName(quote)}</span>
                                <span className="text-[var(--text-muted)]">{formatDate(quote.created_at)}</span>
                            </div>
                            <div className="flex items-center justify-end">
                                <span className="text-sm font-black text-[var(--text-main)]">{formatCurrency(quote.total_amount)}</span>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            <div className="hidden lg:block bg-[var(--bg-card)] border border-[var(--border-soft)] rounded-2xl overflow-hidden shadow-sm">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Nº</TableHead>
                            <TableHead>{columnLabels.title}</TableHead>
                            <TableHead>{columnLabels.client}</TableHead>
                            <TableHead>{columnLabels.date}</TableHead>
                            <TableHead className="text-right">{columnLabels.total}</TableHead>
                            <TableHead className="text-center">{columnLabels.status}</TableHead>
                            <TableHead className="text-center">{columnLabels.actions}</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {quotes.map((quote) => (
                            <TableRow
                                key={quote.id}
                                className="cursor-pointer"
                                onClick={() => onViewQuote(quote)}
                            >
                                <TableCell className="font-semibold">
                                    <Link
                                        href={`/dashboard/quotes/${quote.id}`}
                                        onClick={(e) => e.stopPropagation()}
                                        className="text-accent hover:underline font-mono"
                                    >
                                        {formatQuoteNumber(quote.quote_number)}
                                    </Link>
                                </TableCell>
                                <TableCell className="max-w-[200px] truncate font-medium text-[var(--text-main)]">
                                    {quote.title}
                                </TableCell>
                                <TableCell className="text-[var(--text-muted)] font-medium">
                                    {getClientName(quote)}
                                </TableCell>
                                <TableCell className="text-[var(--text-muted)]">
                                    {formatDate(quote.created_at)}
                                </TableCell>
                                <TableCell className="text-right font-bold text-[var(--text-main)]">
                                    {formatCurrency(quote.total_amount)}
                                </TableCell>
                                <TableCell className="text-center">
                                    <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold ${STATUS_BADGE[quote.status] ?? STATUS_BADGE.draft}`}>
                                        {statusLabels[quote.status] ?? quote.status}
                                    </span>
                                </TableCell>
                                <TableCell
                                    className="text-center relative overflow-visible"
                                    onClick={(e) => e.stopPropagation()}
                                >
                                    <div className="flex justify-center">
                                        <ActionPopover align="end" options={getQuoteActions(quote)} />
                                    </div>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>
        </>
    );
}
