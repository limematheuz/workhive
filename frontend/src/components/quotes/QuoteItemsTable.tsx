"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Copy, Plus, Trash2 } from "lucide-react";
import { ConceptRow } from "@/hooks/useQuoteForm";
import type { Dictionary } from "@/lib/dictionary-context";

interface QuoteItemsTableProps {
    concepts: ConceptRow[];
    dict: Dictionary;
    handleAddManualRow: () => void;
    handleDuplicateRow: (id: string) => void;
    handleUpdateRow: <Field extends keyof ConceptRow>(
        id: string,
        field: Field,
        value: ConceptRow[Field]
    ) => void;
    handleDeleteRow: (id: string) => void;
    /** When true, parent section owns title/surface — table only. */
    embedded?: boolean;
    pricesIncludeTax?: boolean;
}

export function QuoteItemsTable({
    concepts,
    dict,
    handleAddManualRow,
    handleDuplicateRow,
    handleUpdateRow,
    handleDeleteRow,
    embedded = false,
    pricesIncludeTax = false,
}: QuoteItemsTableProps) {
    return (
        <div className={embedded ? "space-y-3" : "space-y-3 pt-2"}>
            {!embedded && (
                <div className="flex items-center justify-between">
                    <Label className="text-xs font-bold uppercase tracking-wider text-[var(--text-main)]">
                        {dict.quotes?.concepts_title || "Conceptos del Presupuesto"}
                    </Label>
                </div>
            )}

            <div className={embedded ? "overflow-x-auto rounded-2xl bg-[var(--bg-tertiary)]/65" : "billing-surface overflow-hidden rounded-[24px]"}>
                <Table className="w-full min-w-[32rem] text-left">
                    <TableHeader>
                        <TableRow className="bg-[var(--bg-tertiary)] text-3xs font-bold uppercase tracking-wider text-[var(--text-muted)] select-none">
                            <TableHead className="px-3 py-2.5">{dict.invoices?.col_description || "Descripción"}</TableHead>
                            <TableHead className="w-24 px-2 py-2.5 text-right">{pricesIncludeTax ? "Precio c/ IVA (€)" : (dict.invoices?.col_price || "Precio (€)")}</TableHead>
                            <TableHead className="w-20 px-2 py-2.5 text-center">{dict.invoices?.col_qty || "Cantidad"}</TableHead>
                            <TableHead className="w-24 px-2 py-2.5 text-right">{pricesIncludeTax ? "Total c/ IVA" : (dict.invoices?.col_total || "Total")}</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody className="divide-y divide-[var(--border-soft)] text-xs">
                        {concepts.length > 0 ? (
                            concepts.map((row) => (
                                <TableRow key={row.id} className="hover:bg-[var(--bg-secondary)]/30">
                                    <TableCell className="py-2 px-3">
                                        <div className="flex items-start gap-2">
                                            <div className="min-w-0 flex-1">
                                                <Label className="sr-only" htmlFor={`quote-concept-${row.id}-description`}>
                                                    {dict.invoices?.col_description || "Descripción"}
                                                </Label>
                                                <Textarea
                                                    id={`quote-concept-${row.id}-description`}
                                                    value={row.description}
                                                    onChange={(e) => handleUpdateRow(row.id, "description", e.target.value)}
                                                    rows={Math.max(2, Math.min(5, row.description.split("\n").length || 2))}
                                                    className="min-h-16 w-full resize-none rounded-lg px-2 py-1.5 text-xs leading-relaxed"
                                                    placeholder="Servicio, detalles incluidos y exclusiones relevantes"
                                                    required
                                                />
                                            </div>
                                            <div className="flex shrink-0 items-center gap-1 pt-0.5">
                                                <Button
                                                    type="button"
                                                    onClick={() => handleDuplicateRow(row.id)}
                                                    aria-label="Duplicar línea"
                                                    title="Duplicar línea"
                                                    variant="secondary"
                                                    size="icon-xs"
                                                    className="size-8 cursor-pointer shadow-none hover:translate-y-0 hover:shadow-none"
                                                >
                                                    <Copy className="h-3.5 w-3.5" />
                                                </Button>
                                                <Button
                                                    type="button"
                                                    onClick={() => handleDeleteRow(row.id)}
                                                    aria-label="Eliminar línea"
                                                    title="Eliminar línea"
                                                    variant="dangerSoft"
                                                    size="icon-xs"
                                                    className="cursor-pointer shadow-none hover:translate-y-0 hover:shadow-none"
                                                >
                                                    <Trash2 className="h-3.5 w-3.5" />
                                                </Button>
                                            </div>
                                        </div>
                                    </TableCell>
                                    <TableCell className="py-2 px-2">
                                        <Label className="sr-only" htmlFor={`quote-concept-${row.id}-price`}>
                                            {dict.invoices?.col_price || "Precio (€)"}
                                        </Label>
                                        <Input
                                            id={`quote-concept-${row.id}-price`}
                                            type="number"
                                            step="0.01"
                                            data-price-input
                                            value={row.unitPrice || ""}
                                            onChange={(e) => handleUpdateRow(row.id, "unitPrice", parseFloat(e.target.value) || 0)}
                                            className="h-8 w-full rounded-lg px-2 text-right text-xs font-mono"
                                            placeholder="0.00"
                                            required
                                        />
                                    </TableCell>
                                    <TableCell className="py-2 px-2">
                                        <Label className="sr-only" htmlFor={`quote-concept-${row.id}-quantity`}>
                                            {dict.invoices?.col_qty || "Cantidad"}
                                        </Label>
                                        <Input
                                            id={`quote-concept-${row.id}-quantity`}
                                            type="number"
                                            step="any"
                                            value={row.quantity || ""}
                                            onChange={(e) => handleUpdateRow(row.id, "quantity", parseFloat(e.target.value) || 0)}
                                            className="h-8 w-full rounded-lg px-2 text-center text-xs font-mono"
                                            placeholder="1"
                                            required
                                        />
                                    </TableCell>
                                    <TableCell className="py-2 px-2 text-right font-mono font-semibold text-[var(--text-main)]">
                                        {(row.unitPrice * row.quantity).toFixed(2)} €
                                    </TableCell>
                                </TableRow>
                            ))
                        ) : (
                            <TableRow>
                                <TableCell colSpan={4} className="py-8 text-center text-xs text-[var(--text-muted)] bg-[var(--bg-secondary)]/10">
                                    {dict.quotes?.no_concepts || "No hay conceptos. Pulsa \"+ Añadir Concepto\" para comenzar."}
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>

            {/* Full-width add line button below the table */}
            <Button
                type="button"
                variant="secondary"
                size="lg"
                onClick={handleAddManualRow}
                className="w-full border-dashed shadow-none hover:translate-y-0 hover:shadow-none"
            >
                <Plus className="h-4 w-4" />
                {dict.quotes?.add_concept || dict.invoices?.add_concept || "Añadir Línea"}
            </Button>
        </div>
    );
}
