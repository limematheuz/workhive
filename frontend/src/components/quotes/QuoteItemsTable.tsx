"use client";

import React from "react";
import { Label } from "@/components/ui/label";
import { Plus, Trash2 } from "lucide-react";
import { ConceptRow } from "@/hooks/useQuoteForm";
import type { Dictionary } from "@/lib/dictionary-context";

interface QuoteItemsTableProps {
    concepts: ConceptRow[];
    dict: Dictionary;
    handleAddManualRow: () => void;
    handleUpdateRow: <Field extends keyof ConceptRow>(
        id: string,
        field: Field,
        value: ConceptRow[Field]
    ) => void;
    handleDeleteRow: (id: string) => void;
}

export function QuoteItemsTable({
    concepts,
    dict,
    handleAddManualRow,
    handleUpdateRow,
    handleDeleteRow,
}: QuoteItemsTableProps) {
    return (
        <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between">
                <Label className="text-xs font-bold text-[var(--text-main)] uppercase tracking-wider">
                    {dict.quotes?.concepts_title || "Conceptos del Presupuesto"}
                </Label>
            </div>

            <div className="border border-[var(--border-soft)] rounded-2xl overflow-hidden bg-[var(--bg-primary)]/50">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="bg-[var(--bg-secondary)]/50 border-b border-[var(--border-soft)] text-3xs uppercase font-bold tracking-wider text-[var(--text-muted)] select-none">
                            <th className="py-2.5 px-3">{dict.invoices?.col_description || "Descripción"}</th>
                            <th className="py-2.5 px-2 text-right w-24">{dict.invoices?.col_price || "Precio (€)"}</th>
                            <th className="py-2.5 px-2 text-center w-20">{dict.invoices?.col_qty || "Cantidad"}</th>
                            <th className="py-2.5 px-2 text-right w-24">{dict.invoices?.col_total || "Total"}</th>
                            <th className="py-2.5 px-2 w-10"></th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--border-soft)] text-xs">
                        {concepts.length > 0 ? (
                            concepts.map((row) => (
                                <tr key={row.id} className="hover:bg-[var(--bg-secondary)]/30">
                                    <td className="py-2 px-3">
                                        <input
                                            type="text"
                                            value={row.description}
                                            onChange={(e) => handleUpdateRow(row.id, "description", e.target.value)}
                                            className="w-full bg-transparent border-none outline-none focus:ring-0 text-xs text-[var(--text-main)]"
                                            placeholder={dict.invoices?.col_description_placeholder || "Descripción del trabajo..."}
                                            required
                                        />
                                    </td>
                                    <td className="py-2 px-2">
                                        <input
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
                                        <input
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
                                    <td className="py-2 px-2 text-center">
                                        <button
                                            type="button"
                                            onClick={() => handleDeleteRow(row.id)}
                                            aria-label="Eliminar línea"
                                            className="text-[var(--btn-cancel-text)] hover:text-[var(--btn-cancel-text)] bg-transparent border-none cursor-pointer flex items-center justify-center mx-auto"
                                        >
                                            <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                    </td>
                                </tr>
                            ))
                        ) : (
                            <tr>
                                <td colSpan={5} className="py-8 text-center text-xs text-[var(--text-muted)] bg-[var(--bg-secondary)]/10">
                                    {dict.quotes?.no_concepts || "No hay conceptos. Pulsa \"+ Añadir Concepto\" para comenzar."}
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
                className="w-full flex items-center justify-center gap-2 py-2.5 text-xs font-semibold text-[var(--text-muted)] hover:text-[var(--text-main)] border border-dashed border-[var(--border-color)] rounded-xl hover:border-[var(--border-soft)] hover:bg-[var(--bg-secondary)] transition-all cursor-pointer bg-transparent"
            >
                <Plus className="w-3.5 h-3.5" />
                {dict.quotes?.add_concept || dict.invoices?.add_concept || "Añadir Línea"}
            </button>
        </div>
    );
}
