"use client";

import { Edit3, Eye, FileText, Trash2 } from "lucide-react";
import { ActionPopover } from "@/components/ui/action-popover";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { QUOTE_STATUS_BADGE as STATUS_BADGE } from "@/lib/constants";
import { formatCurrency, formatDate, formatQuoteNumber } from "@/lib/format";
import { isQuoteContentEditable } from "@/lib/quote-editability";
import type { Quote } from "@/types/quote";

type QuotesListSectionProps = {
    quotes: Quote[]; statusLabels: Record<string, string>; emptyLabel: string;
    columnLabels: { title: string; client: string; date: string; total: string; status: string; actions: string };
    getClientName: (quote: Quote) => string; onViewQuote: (quote: Quote) => void; onEditQuote: (quote: Quote) => void; onDeleteQuote: (quoteId: number) => void;
};

export function QuotesListSection({ quotes, statusLabels, emptyLabel, columnLabels, getClientName, onViewQuote, onEditQuote, onDeleteQuote }: QuotesListSectionProps) {
    const actions = (quote: Quote) => [{ label: "Ver", icon: Eye, onClick: () => onViewQuote(quote) }, ...(isQuoteContentEditable(quote.status) ? [{ label: "Editar", icon: Edit3, onClick: () => onEditQuote(quote), variant: "edit" as const }] : []), { label: "Eliminar", icon: Trash2, onClick: () => onDeleteQuote(quote.id), variant: "delete" as const }];
    return <section className="billing-surface overflow-hidden rounded-[26px]">
        <header className="px-5 py-4"><h2 className="text-sm font-semibold text-[var(--text-main)]">Presupuestos registrados</h2><p className="mt-1 text-xs text-[var(--text-muted)]">Pulsa una fila para abrir el detalle sin pasos extra.</p></header>
        {quotes.length === 0 ? <div className="px-5 py-16 text-center"><FileText className="mx-auto mb-3 size-10 text-[var(--text-muted)] opacity-50" /><p className="text-sm font-medium text-[var(--text-muted)]">{emptyLabel}</p></div> : <>
            <div className="space-y-2.5 p-3 lg:hidden">{quotes.map((quote) => <Button key={quote.id} type="button" variant="ghost" onClick={() => onViewQuote(quote)} className="billing-block h-auto w-full justify-start rounded-2xl p-3 text-left hover:translate-y-0 hover:shadow-none"><span className="min-w-0 flex-1"><span className="flex items-start justify-between gap-2"><span><span className="font-mono text-xs font-semibold text-accent">{formatQuoteNumber(quote.quote_number)}</span><span className="mt-1 block truncate text-sm font-semibold text-[var(--text-main)]">{quote.title}</span></span><span className={`rounded-full px-2 py-0.5 text-[9px] font-semibold uppercase ${STATUS_BADGE[quote.status] ?? STATUS_BADGE.draft}`}>{statusLabels[quote.status] ?? quote.status}</span></span><span className="mt-2 flex justify-between border-t border-[var(--border-soft)] pt-2 text-xs text-[var(--text-muted)]"><span>{getClientName(quote)}</span><span>{formatCurrency(quote.total_amount)}</span></span></span></Button>)}</div>
            <div className="hidden overflow-x-auto p-3 lg:block"><Table className="min-w-[820px] table-fixed text-left"><colgroup><col className="w-[12%]" /><col className="w-[24%]" /><col className="w-[20%]" /><col className="w-[14%]" /><col className="w-[12%]" /><col className="w-[11%]" /><col className="w-[7%]" /></colgroup><TableHeader><TableRow className="bg-[var(--bg-secondary)]/40 text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--text-muted)]"><TableHead>Nº</TableHead><TableHead>{columnLabels.title}</TableHead><TableHead>{columnLabels.client}</TableHead><TableHead>{columnLabels.date}</TableHead><TableHead className="text-right">{columnLabels.total}</TableHead><TableHead className="text-center">{columnLabels.status}</TableHead><TableHead className="text-right">{columnLabels.actions}</TableHead></TableRow></TableHeader><TableBody>{quotes.map((quote) => <TableRow key={quote.id} onClick={() => onViewQuote(quote)} className="cursor-pointer bg-[var(--bg-secondary)]/20 hover:bg-[var(--bg-secondary)]/55"><TableCell><Button type="button" variant="link" onClick={(event) => { event.stopPropagation(); onViewQuote(quote); }} className="h-auto border-0 bg-transparent p-0 font-mono text-sm font-semibold text-accent shadow-none hover:bg-transparent hover:shadow-none hover:no-underline">{formatQuoteNumber(quote.quote_number)}</Button></TableCell><TableCell className="truncate font-medium text-[var(--text-main)]">{quote.title}</TableCell><TableCell className="truncate text-sm text-[var(--text-muted)]">{getClientName(quote)}</TableCell><TableCell className="text-sm text-[var(--text-muted)]">{formatDate(quote.created_at)}</TableCell><TableCell className="text-right font-mono text-sm font-semibold text-[var(--text-main)]">{formatCurrency(quote.total_amount)}</TableCell><TableCell className="text-center"><span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_BADGE[quote.status] ?? STATUS_BADGE.draft}`}>{statusLabels[quote.status] ?? quote.status}</span></TableCell><TableCell className="text-right" onClick={(event) => event.stopPropagation()}><ActionPopover align="end" options={actions(quote)} /></TableCell></TableRow>)}</TableBody></Table></div>
        </>}
    </section>;
}
