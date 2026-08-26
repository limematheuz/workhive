"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { BriefcaseBusiness, Copy, Plus, Trash2 } from "lucide-react";
import { ConceptRow } from "@/hooks/useInvoiceForm";
import type { Dictionary } from "@/lib/dictionary-context";
import { formatHoursShort } from "@/lib/format-hours";
import { InvoiceConceptDescriptionField } from "./InvoiceConceptDescription";

interface InvoiceConceptsTableProps {
    concepts: ConceptRow[];
    dict: Dictionary;
    handleAddManualRow: () => void;
    handleDuplicateRow: (id: string) => void;
    handleAddExternalLaundryRow: (description?: string) => void;
    handleUpdateRow: <Field extends keyof ConceptRow>(
        id: string,
        field: Field,
        value: ConceptRow[Field]
    ) => void;
    handleDeleteRow: (id: string) => void;
    pricesIncludeTax: boolean;
}

export function InvoiceConceptsTable({
    concepts,
    dict,
    handleAddManualRow,
    handleDuplicateRow,
    handleAddExternalLaundryRow,
    handleUpdateRow,
    handleDeleteRow,
    pricesIncludeTax,
}: InvoiceConceptsTableProps) {
    const [externalService, setExternalService] = React.useState("");

    return (
        <section className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                    <Label className="text-sm font-black text-[var(--text-main)]">
                        Conceptos facturados
                    </Label>
                    <p className="mt-1 text-xs text-[var(--text-muted)]">
                        Las tareas terminadas conservan el precio pactado al iniciar. Las líneas manuales se pueden editar.
                    </p>
                </div>
                <div className="flex flex-wrap items-center justify-end gap-2">
                    <Select
                        value={externalService}
                        onValueChange={(description) => {
                            handleAddExternalLaundryRow(description);
                            setExternalService("");
                        }}
                    >
                        <SelectTrigger
                            aria-label="Añadir servicio externo"
                            className="h-10 min-w-52 border-[var(--btn-secondary-border)] bg-[var(--btn-secondary-bg)] px-3 text-xs font-semibold text-[var(--btn-secondary-text)]"
                        >
                            <BriefcaseBusiness className="h-4 w-4 shrink-0" aria-hidden="true" />
                            <SelectValue placeholder="Añadir servicio externo" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="Servicio externo">Servicio externo</SelectItem>
                            <SelectItem value="Lavandería">Lavandería</SelectItem>
                            <SelectItem value="Otro servicio">Otro servicio</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </div>

            <div className="overflow-hidden rounded-[22px] border border-[var(--border-soft)] bg-[var(--bg-card-solid)]">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="bg-[var(--bg-secondary)]/50 border-b border-[var(--border-soft)] text-3xs uppercase font-bold tracking-wider text-[var(--text-muted)] select-none">
                            <th className="py-2.5 px-3">{dict.invoices?.col_description || "Descripción"}</th>
                            <th className="py-2.5 px-2 text-right w-28">{pricesIncludeTax ? "Precio c/ IVA (€)" : (dict.invoices?.col_price || "Precio (€)")}</th>
                            <th className="py-2.5 px-2 text-center w-24">{dict.invoices?.col_qty || "Cantidad"}</th>
                            <th className="py-2.5 px-2 text-right w-24">{pricesIncludeTax ? "Total c/ IVA" : (dict.invoices?.col_total || "Total")}</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--border-soft)] text-xs">
                        {concepts.length > 0 ? (
                            concepts.map((row) => {
                                const isHourly = row.pricing_mode === "hourly";
                                const taskPricingLocked = Boolean(row.task_item_id);
                                const workedLabel = row.worked_seconds
                                    ? formatHoursShort(row.worked_seconds)
                                    : null;
                                return (
                                    <tr key={row.id} className="odd:bg-[var(--bg-secondary)]/15 hover:bg-[var(--btn-secondary-bg)]/40">
                                        <td className="px-3 py-2.5 align-middle">
                                            <div className="flex items-start gap-2">
                                                <div className="min-w-0 flex-1 space-y-2">
                                                    <InvoiceConceptDescriptionField
                                                        id={`invoice-concept-${row.id}-description`}
                                                        label={dict.invoices?.col_description || "Descripción"}
                                                        value={row.description}
                                                        onChange={(value) => handleUpdateRow(row.id, "description", value)}
                                                        placeholder={dict.invoices?.col_description_placeholder || "Descripción del trabajo..."}
                                                    />
                                                    {row.task_item_id ? (
                                                        <div className="flex flex-wrap items-center gap-1.5">
                                                            <span className="rounded-md border border-[var(--border-soft)] bg-[var(--bg-secondary)] px-2 py-1 text-[10px] font-semibold text-[var(--text-muted)]">
                                                                {isHourly ? "Por horas pactado" : "Precio fijo pactado"}
                                                            </span>
                                                            {isHourly && workedLabel && (
                                                                <span className="text-[10px] text-[var(--text-muted)]">
                                                                    {workedLabel} registrados
                                                                </span>
                                                            )}
                                                        </div>
                                                    ) : null}
                                                </div>
                                                <div className="flex shrink-0 items-center gap-1">
                                                    <button
                                                        type="button"
                                                        onClick={() => handleDuplicateRow(row.id)}
                                                        aria-label="Duplicar línea"
                                                        title="Duplicar línea"
                                                        className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-lg border border-[var(--btn-secondary-border)] bg-[var(--btn-secondary-bg)] text-[var(--btn-secondary-text)] transition-colors hover:bg-[var(--btn-secondary-hover-bg)]"
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
                                        <td className="px-2 py-2.5 align-middle">
                                            <label
                                                htmlFor={`invoice-concept-${row.id}-price`}
                                                className="mb-1 block text-right text-[10px] font-semibold uppercase tracking-wide text-[var(--text-muted)]"
                                            >
                                                {isHourly ? "€ / h" : "Precio"}
                                            </label>
                                            <Input
                                                id={`invoice-concept-${row.id}-price`}
                                                type="number"
                                                step="0.01"
                                                data-price-input
                                                value={row.unitPrice || ""}
                                                onChange={(e) => handleUpdateRow(row.id, "unitPrice", parseFloat(e.target.value) || 0)}
                                                readOnly={taskPricingLocked}
                                                className="h-8 w-full rounded-lg border border-[var(--border-soft)] bg-[var(--bg-primary)] px-2 text-right font-mono text-xs text-[var(--text-main)] outline-none focus:border-accent read-only:bg-[var(--bg-secondary)]"
                                                placeholder={isHourly ? "20.00" : "0.00"}
                                                required
                                            />
                                        </td>
                                        <td className="px-2 py-2.5 align-middle">
                                            <label
                                                htmlFor={`invoice-concept-${row.id}-quantity`}
                                                className="mb-1 block text-center text-[10px] font-semibold uppercase tracking-wide text-[var(--text-muted)]"
                                            >
                                                {isHourly ? "Horas" : "Cant."}
                                            </label>
                                            <Input
                                                id={`invoice-concept-${row.id}-quantity`}
                                                type="number"
                                                step="any"
                                                value={row.quantity || ""}
                                                onChange={(e) => handleUpdateRow(row.id, "quantity", parseFloat(e.target.value) || 0)}
                                                readOnly={taskPricingLocked}
                                                className="h-8 w-full rounded-lg border border-[var(--border-soft)] bg-[var(--bg-primary)] px-2 text-center font-mono text-xs text-[var(--text-main)] outline-none focus:border-accent read-only:bg-[var(--bg-secondary)]"
                                                placeholder="1"
                                                required
                                            />
                                        </td>
                                        <td className="px-2 py-2.5 align-middle text-right font-mono text-sm font-semibold text-[var(--text-main)]">
                                            {(row.unitPrice * row.quantity).toFixed(2)} €
                                        </td>
                                    </tr>
                                );
                            })
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

            <Button
                type="button"
                variant="secondary"
                size="lg"
                onClick={handleAddManualRow}
                className="w-full border-dashed shadow-none hover:translate-y-0 hover:shadow-none"
            >
                <Plus className="h-4 w-4" />
                {dict.invoices?.add_concept || "Añadir Línea"}
            </Button>
        </section>
    );
}
