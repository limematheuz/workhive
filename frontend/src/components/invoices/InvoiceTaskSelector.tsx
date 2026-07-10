"use client";

import React from "react";
import { Label } from "@/components/ui/label";
import { Loader2, Check, Package } from "lucide-react";
import { TaskItem } from "@/services/task.service";
import type { Dictionary } from "@/lib/dictionary-context";

interface InvoiceTaskSelectorProps {
    dict: Dictionary;
    availableTasks: (TaskItem & { locationName: string })[];
    selectedTaskIds: number[];
    loadingTasks: boolean;
    handleToggleAll: () => void;
    handleToggleTask: (task: TaskItem & { locationName: string }) => void;
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
                <div className="space-y-2 max-h-[180px] overflow-y-auto pr-1">
                    {availableTasks.map(task => {
                        const isChecked = selectedTaskIdSet.has(task.id);
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
                                        className={`w-3.5 h-3.5 rounded border flex items-center justify-center transition-all ${
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
                                            "client_name" in task
                                                ? String(task.client_name || "")
                                                : "",
                                            task.locationName,
                                        ].filter(Boolean).join(" · ")}
                                    </p>
                                    <div className="flex items-center gap-1.5 mt-0.5 text-3xs text-[var(--text-muted)] font-mono">
                                        <span>{task.price || 0} €</span>
                                        <span>•</span>
                                        <span className="inline-flex items-center gap-0.5">
                                            <Package className="h-2.5 w-2.5" />
                                            Cant. {task.quantity || 1}
                                        </span>
                                    </div>
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
