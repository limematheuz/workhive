"use client";

import React from "react";
import { Label } from "@/components/ui/label";
import { Copy, Plus, Shirt, Trash2 } from "lucide-react";
import { ConceptRow } from "@/hooks/useInvoiceForm";
import type { Dictionary } from "@/lib/dictionary-context";

interface InvoiceConceptsTableProps {
    concepts: ConceptRow[];
    dict: Dictionary;
    handleAddManualRow: () => void;
    handleDuplicateRow: (id: string) => void;
    handleAddExternalLaundryRow: () => void;
    handleUpdateRow: <Field extends keyof ConceptRow>(
        id: string,
        field: Field,
        value: ConceptRow[Field]
    ) => void;
    handleDeleteRow: (id: string) => void;
}

export function InvoiceConceptsTable({
    concepts,
    dict,
    handleAddManualRow,
    handleDuplicateRow,
    handleAddExternalLaundryRow,
    handleUpdateRow,
    handleDeleteRow,
}: InvoiceConceptsTableProps) {
    return (
        <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between">
                <Label className="text-xs font-bold text-[var(--text-main)] uppercase tracking-wider">
                    {dict.invoices?.concepts_title || "Conceptos de la Factura"}
                </Label>
                <div className="flex flex-wrap items-center justify-end gap-2">
                    <button
                        type="button"
                        onClick={handleAddExternalLaundryRow}
                        className="flex items-center gap-1.5 text-xs font-semibold text-[var(--text-main)] transition-colors px-3 py-1.5 rounded-lg bg-[var(--bg-tertiary)] hover:bg-[var(--bg-secondary)] border border-[var(--border-soft)] cursor-pointer"
                        title="Añadir una línea facturable de lavandería hecha por una empresa externa"
                    >
                        <Shirt className="w-3.5 h-3.5" />
                        Lavandería externa
                    </button>
                </div>
            </div>

            <div className="border border-[var(--border-soft)] rounded-2xl overflow-hidden bg-[var(--bg-primary)]/50">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="bg-[var(--bg-secondary)]/50 border-b border-[var(--border-soft)] text-3xs uppercase font-bold tracking-wider text-[var(--text-muted)] select-none">
                            <th className="py-2.5 px-3">{dict.invoices?.col_description || "Descripción"}</th>
                            <th className="py-2.5 px-2 text-right w-24">{dict.invoices?.col_price || "Precio (€)"}</th>
                            <th className="py-2.5 px-2 text-center w-20">{dict.invoices?.col_qty || "Cantidad"}</th>
                            <th className="py-2.5 px-2 text-right w-24">{dict.invoices?.col_total || "Total"}</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--border-soft)] text-xs">
                        {concepts.length > 0 ? (
                            concepts.map((row) => (
                                <tr key={row.id} className="hover:bg-[var(--bg-secondary)]/30">
                                    <td className="py-2 px-3">
                                        <div className="flex items-start gap-2">
                                            <div className="min-w-0 flex-1">
                                                <label className="sr-only" htmlFor={`invoice-concept-${row.id}-description`}>
                                                    {dict.invoices?.col_description || "Descripción"}
                                                </label>
                                                <textarea
                                                    id={`invoice-concept-${row.id}-description`}
                                                    value={row.description}
                                                    onChange={(e) => handleUpdateRow(row.id, "description", e.target.value)}
                                                    rows={Math.max(2, Math.min(4, row.description.split("\n").length))}
                                                    className="w-full resize-none border-none bg-transparent text-xs leading-relaxed text-[var(--text-main)] outline-none focus:ring-0"
                                                    placeholder={dict.invoices?.col_description_placeholder || "Descripción del trabajo..."}
                                                    required
                                                />
                                            </div>
                                            <div className="flex shrink-0 items-center gap-1 pt-0.5">
                                                <button
                                                    type="button"
                                                    onClick={() => handleDuplicateRow(row.id)}
                                                    aria-label="Duplicar línea"
                                                    title="Duplicar línea"
                                                    className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-lg border border-accent/30 bg-accent/10 text-accent transition-colors hover:bg-accent hover:text-white"
                                                >
                                                    <Copy className="h-3.5 w-3.5" />
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => handleDeleteRow(row.id)}
                                                    aria-label="Eliminar línea"
                                                    title="Eliminar línea"
                                                    className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-lg border border-[var(--btn-cancel-border)] bg-[var(--btn-cancel-bg)] text-[var(--btn-cancel-text)] transition-colors hover:bg-[var(--btn-cancel-hover-bg)]"
                                                >
                                                    <Trash2 className="h-3.5 w-3.5" />
                                                </button>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="py-2 px-2">
                                        <label className="sr-only" htmlFor={`invoice-concept-${row.id}-price`}>
                                            {dict.invoices?.col_price || "Precio (€)"}
                                        </label>
                                        <input
                                            id={`invoice-concept-${row.id}-price`}
                                            type="number"
                                            step="0.01"
                                            value={row.unitPrice || ""}
                                            onChange={(e) => handleUpdateRow(row.id, "unitPrice", parseFloat(e.target.value) || 0)}
                                            className="w-full bg-transparent border-none outline-none text-right focus:ring-0 text-xs font-mono text-[var(--text-main)]"
                                            placeholder="0.00"
                                            required
                                        />
                                    </td>
                                    <td className="py-2 px-2">
                                        <label className="sr-only" htmlFor={`invoice-concept-${row.id}-quantity`}>
                                            {dict.invoices?.col_qty || "Cantidad"}
                                        </label>
                                        <input
                                            id={`invoice-concept-${row.id}-quantity`}
                                            type="number"
                                            step="any"
                                            value={row.quantity || ""}
                                            onChange={(e) => handleUpdateRow(row.id, "quantity", parseFloat(e.target.value) || 0)}
                                            className="w-full bg-transparent border-none outline-none text-center focus:ring-0 text-xs font-mono text-[var(--text-main)]"
                                            placeholder="1"
                                            required
                                        />
                                    </td>
                                    <td className="py-2 px-2 text-right font-mono font-semibold text-[var(--text-main)]">
                                        {(row.unitPrice * row.quantity).toFixed(2)} €
                                    </td>
                                </tr>
                            ))
                        ) : (
                            <tr>
                                <td colSpan={4} className="py-8 text-center text-xs text-[var(--text-muted)] bg-[var(--bg-secondary)]/10">
                                    {dict.invoices?.no_concepts || "No hay conceptos. Selecciona tareas pendientes a la derecha o pulsa \"+ Añadir Concepto\"."}
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {/* Full-width add line button below the table */}
            <button
                type="button"
                onClick={handleAddManualRow}
                className="w-full flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-accent/50 bg-accent/10 py-3 text-sm font-bold text-accent transition-colors hover:border-accent hover:bg-accent hover:text-white ui-motion"
            >
                <Plus className="h-4 w-4" />
                {dict.invoices?.add_concept || "Añadir Línea"}
            </button>
        </div>
    );
}
