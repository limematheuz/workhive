"use client";

import React from "react";
import { Label } from "@/components/ui/label";
import { Loader2, Check, Package } from "lucide-react";
import type { Dictionary } from "@/lib/dictionary-context";
import { formatHoursShort } from "@/lib/format-hours";
import {
    formatWorkerHoursLine,
    resolveTaskInvoiceBilling,
    resolveTaskPersonSeconds,
} from "@/lib/task-invoice-billing";
import type { InvoiceableTask } from "@/services/invoice.service";

type SelectableInvoiceTask = InvoiceableTask & { locationName: string };

interface InvoiceTaskSelectorProps {
    dict: Dictionary;
    availableTasks: SelectableInvoiceTask[];
    selectedTaskIds: number[];
    loadingTasks: boolean;
    handleToggleAll: () => void;
    handleToggleTask: (task: SelectableInvoiceTask) => void;
}

export function InvoiceTaskSelector({
    dict,
    availableTasks,
    selectedTaskIds,
    loadingTasks,
    handleToggleAll,
    handleToggleTask,
}: InvoiceTaskSelectorProps) {
    const selectedTaskIdSet = new Set(selectedTaskIds);
    return (
        <div className="space-y-2">
            <div className="flex items-center justify-between">
                <Label className="text-xs font-bold text-[var(--text-main)] uppercase tracking-wider">
                    {dict.invoices?.client_jobs || "Trabajos del Cliente"}
                </Label>
                {availableTasks.length > 0 && (
                    <button
                        type="button"
                        onClick={handleToggleAll}
                        className="text-xs text-accent hover:underline font-medium border-none bg-transparent cursor-pointer"
                    >
                        {selectedTaskIds.length === availableTasks.length
                            ? (dict.invoices?.deselect_all || "Deseleccionar todo")
                            : (dict.invoices?.select_all || "Seleccionar todo")}
                    </button>
                )}
            </div>

            {loadingTasks ? (
                <div className="flex items-center justify-center py-6 gap-2">
                    <Loader2 className="w-4 h-4 text-accent animate-spin" />
                    <span className="text-xs text-[var(--text-muted)]">{dict.invoices?.searching_tasks || "Buscando tareas..."}</span>
                </div>
            ) : availableTasks.length > 0 ? (
                <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                    {availableTasks.map(task => {
                        const isChecked = selectedTaskIdSet.has(task.id);
                        const billing = resolveTaskInvoiceBilling(task);
                        const personSeconds = resolveTaskPersonSeconds(task);
                        const workersLine = formatWorkerHoursLine(task.workers, formatHoursShort);
                        return (
                            <div
                                key={task.id}
                                role="checkbox"
                                aria-checked={isChecked}
                                aria-label={task.title}
                                tabIndex={0}
                                onClick={() => handleToggleTask(task)}
                                onKeyDown={(event) => {
                                    if (event.key === "Enter" || event.key === " ") {
                                        if (event.key === " ") event.preventDefault();
                                        handleToggleTask(task);
                                    }
                                }}
                                className={`flex items-start gap-2 p-2.5 rounded-xl border border-[var(--border-soft)] cursor-pointer select-none transition-colors ${
                                    isChecked
                                        ? "bg-[var(--bg-primary)] border-accent/40"
                                        : "bg-[var(--bg-secondary)] hover:bg-[var(--bg-tertiary)]"
                                }`}
                            >
                                <div className="mt-0.5">
                                    <div
                                        className={`w-3.5 h-3.5 rounded border flex items-center justify-center ui-motion ${
                                            isChecked
                                                ? "bg-accent border-accent text-white"
                                                : "border-[var(--border-color)] bg-[var(--bg-primary)]"
                                        }`}
                                    >
                                        {isChecked && <Check className="w-2.5 h-2.5 stroke-[3px]" />}
                                    </div>
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-xs font-semibold text-[var(--text-main)] truncate">
                                        {task.title}
                                    </p>
                                    <p className="text-3xs text-[var(--text-muted)] truncate">
                                        {[
                                            task.client_name || "",
                                            task.locationName,
                                        ].filter(Boolean).join(" · ")}
                                    </p>
                                    <div className="mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-3xs font-mono text-[var(--text-muted)]">
                                        {task.pricing_mode === "hourly" ? (
                                            <span>
                                                {formatHoursShort(personSeconds)} × {billing.unitPrice} €/h
                                            </span>
                                        ) : (
                                            <>
                                                <span>{billing.unitPrice} €</span>
                                                <span>•</span>
                                                <span className="inline-flex items-center gap-0.5">
                                                    <Package className="h-2.5 w-2.5" />
                                                    Cant. {billing.quantity}
                                                </span>
                                            </>
                                        )}
                                        {personSeconds > 0 && (
                                            <>
                                                <span>•</span>
                                                <span className="font-semibold text-[var(--text-main)]">
                                                    Horas-persona {formatHoursShort(personSeconds)}
                                                </span>
                                            </>
                                        )}
                                    </div>
                                    {workersLine && (
                                        <p className="mt-0.5 truncate text-3xs text-[var(--text-muted)]">
                                            {workersLine}
                                        </p>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            ) : (
                <div className="text-center py-5 bg-[var(--bg-secondary)]/50 rounded-xl border border-[var(--border-soft)]">
                    <p className="text-2xs text-[var(--text-muted)]">
                        {dict.invoices?.no_pending_tasks || "Sin tareas pendientes de facturar."}
                    </p>
                </div>
            )}
        </div>
    );
}
