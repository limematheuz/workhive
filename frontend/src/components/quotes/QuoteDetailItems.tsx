"use client";

import { splitStoredTaxAmount } from "@/lib/billing-calculations";
import type { Dictionary } from "@/lib/dictionary-context";
import { formatCurrency } from "@/lib/format";
import type { Quote } from "@/types/quote";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type QuoteDetailItemsProps = {
    quote: Quote;
    dict: Dictionary;
};

export function QuoteDetailItems({ quote, dict }: QuoteDetailItemsProps) {
    const linesSubtotal = quote.items.reduce((acc, item) => acc + item.subtotal, 0);
    const { pureVatAmount, surchargeAmount } = splitStoredTaxAmount(
        quote.tax_amount,
        quote.base_amount,
        quote.equivalence_surcharge || 0,
    );
    const discountAmount = linesSubtotal * ((quote.discount || 0) / 100);
    const retentionAmount = quote.base_amount * ((quote.retention || 0) / 100);
    const taxPercent = Math.round((quote.tax_rate ?? 0.21) * 100);

    return (
        <div className="space-y-5">
            <div className="-mx-1 overflow-x-auto px-1">
                <div className="min-w-[560px] overflow-hidden rounded-2xl bg-[var(--bg-tertiary)]/65">
                    <Table className="w-full table-fixed border-collapse text-left text-[11px]">
                        <TableHeader>
                            <TableRow className="bg-[color-mix(in_srgb,var(--accent-color)_16%,var(--bg-secondary))] text-[9px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                                <TableHead className="px-3 py-2.5">{dict.invoices?.concept || "Concepto"}</TableHead>
                                <TableHead className="w-14 px-2 py-2 text-center">{dict.invoices?.quantity || "Cant."}</TableHead>
                                <TableHead className="w-24 px-2 py-2 text-right">{dict.invoices?.price || "Precio"}</TableHead>
                                <TableHead className="w-14 px-2 py-2 text-center">{dict.invoices?.tax || "IVA"}</TableHead>
                                <TableHead className="w-28 px-3 py-2.5 text-right">{dict.invoices?.subtotal || "Subtotal"}</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody className="divide-y divide-white/35">
                            {quote.items.length > 0 ? (
                                quote.items.map((item, idx) => (
                                    <TableRow
                                        key={item.id}
                                        className={idx % 2 === 0 ? "bg-[var(--bg-secondary)]/65" : "bg-[var(--bg-tertiary)]/85"}
                                    >
                                        <TableCell className="px-3 py-3 font-semibold leading-5 text-[var(--text-main)]">
                                            <span className="block border-l-2 border-[var(--accent-color)] pl-2.5 whitespace-pre-wrap break-words">
                                                {item.description}
                                            </span>
                                        </TableCell>
                                        <TableCell className="px-2 py-2.5 text-center font-mono font-semibold text-[var(--text-muted)]">
                                            {item.quantity}
                                        </TableCell>
                                        <TableCell className="px-2 py-2.5 text-right font-mono text-[var(--text-muted)]">
                                            {formatCurrency(item.unit_price)}
                                        </TableCell>
                                        <TableCell className="px-2 py-2.5 text-center font-mono text-[var(--text-muted)]">
                                            {taxPercent}%
                                        </TableCell>
                                        <TableCell className="px-3 py-2.5 text-right font-mono font-semibold text-[var(--text-main)]">
                                            {formatCurrency(item.subtotal)}
                                        </TableCell>
                                    </TableRow>
                                ))
                            ) : (
                                <TableRow>
                                    <TableCell colSpan={5} className="py-8 text-center font-medium text-[var(--text-muted)]">
                                        {dict.quotes?.items_label || "Sin líneas"}
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </div>
            </div>

            <div className="flex justify-end">
                <div className="w-full max-w-72 space-y-1.5 text-[11px]">
                    {quote.discount > 0 && (
                        <>
                            <div className="flex justify-between text-[var(--text-muted)]">
                                <span>{dict.invoices?.subtotal_desc || "Subtotal"}</span>
                                <span className="font-mono">{formatCurrency(linesSubtotal)}</span>
                            </div>
                            <div className="flex justify-between text-[var(--text-muted)]">
                                <span>{dict.invoices?.global_discount || "Descuento"} ({quote.discount}%)</span>
                                <span className="font-mono">-{formatCurrency(discountAmount)}</span>
                            </div>
                        </>
                    )}
                    <div className="flex justify-between font-semibold text-[var(--text-muted)]">
                        <span>{dict.invoices?.base_amount || "Base imponible"}</span>
                        <span className="font-mono">{formatCurrency(quote.base_amount)}</span>
                    </div>
                    <div className="flex justify-between text-[var(--text-muted)]">
                        <span>IVA ({taxPercent}%)</span>
                        <span className="font-mono">{formatCurrency(pureVatAmount)}</span>
                    </div>
                    {quote.equivalence_surcharge > 0 && (
                        <div className="flex justify-between text-[var(--text-muted)]">
                            <span>{dict.invoices?.equivalence_surcharge || "Recargo Equiv."} ({quote.equivalence_surcharge}%)</span>
                            <span className="font-mono">{formatCurrency(surchargeAmount)}</span>
                        </div>
                    )}
                    {quote.retention > 0 && (
                        <div className="flex justify-between font-medium text-[var(--btn-cancel-text)]">
                            <span>{dict.invoices?.retention_irpf || "Retención IRPF"} ({quote.retention}%)</span>
                            <span className="font-mono">-{formatCurrency(retentionAmount)}</span>
                        </div>
                    )}
                    <div className="mt-2 flex justify-between rounded-2xl bg-[color-mix(in_srgb,var(--accent-color)_12%,var(--bg-tertiary))] px-4 py-3 text-sm font-semibold text-[var(--text-main)]">
                        <span>{dict.invoices?.total_amount || "Total"}</span>
                        <span className="font-mono text-lg">{formatCurrency(quote.total_amount)}</span>
                    </div>
                </div>
            </div>
        </div>
    );
}
