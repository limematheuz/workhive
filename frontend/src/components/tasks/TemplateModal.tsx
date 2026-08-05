"use client";

import React from "react";
import { Loader2 } from "lucide-react";
import { TemplateTask } from "@/hooks/useTasksPage";
import type { Dictionary } from "@/lib/dictionary-context";
import { ChecklistStepsEditor } from "./ChecklistStepsEditor";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog";
import {
    taskDialogBodyClass,
    taskDialogContentClass,
    taskDialogDangerBtnClass,
    taskDialogFooterClass,
    taskDialogHeaderClass,
    taskDialogOverlayClass,
    taskDialogPrimaryBtnClass,
} from "./taskDialogChrome";

const UNIT_OPTIONS = [
    "unit", "hour", "m²", "m³", "ml", "kg", "litre", "service", "day", "week", "month"
];

interface TemplateModalProps {
    dict: Dictionary;
    isSaving: boolean;
    isTemplateModalOpen: boolean;
    setIsTemplateModalOpen: (open: boolean) => void;
    selectedTemplate: TemplateTask | null;
    tmplName: string;
    setTmplName: (val: string) => void;
    tmplDescription: string;
    setTmplDescription: (val: string) => void;
    tmplPrice: string;
    setTmplPrice: (val: string) => void;
    tmplUnit: string;
    setTmplUnit: (val: string) => void;
    handleSaveTemplate: (e: React.FormEvent) => void;
}

export function TemplateModal({
    dict,
    isSaving,
    isTemplateModalOpen,
    setIsTemplateModalOpen,
    selectedTemplate,
    tmplName,
    setTmplName,
    tmplDescription,
    setTmplDescription,
    tmplPrice,
    setTmplPrice,
    tmplUnit,
    setTmplUnit,
    handleSaveTemplate,
}: TemplateModalProps) {
    return (
        <Dialog open={isTemplateModalOpen} onOpenChange={setIsTemplateModalOpen}>
            <DialogContent
                overlayClassName={taskDialogOverlayClass}
                className={`${taskDialogContentClass} max-h-[min(90vh,720px)] sm:max-w-md`}
            >
                <DialogHeader className={taskDialogHeaderClass}>
                    <DialogTitle className="text-lg font-bold tracking-tight text-[var(--text-main)]">
                        {selectedTemplate ? "Edit service" : "New service"}
                    </DialogTitle>
                    <DialogDescription className="mt-1 text-xs font-semibold text-[var(--text-muted)]">
                        Define the service and the steps the team must complete.
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSaveTemplate} className="flex min-h-0 flex-1 flex-col font-sans">
                    <div className={taskDialogBodyClass}>
                        <div className="space-y-1">
                            <label htmlFor="template-name" className="text-xs uppercase font-bold text-[var(--text-muted)]">{dict.tasks.template_dialog.name_label}</label>
                            <input
                                id="template-name"
                                type="text"
                                value={tmplName}
                                onChange={(e) => setTmplName(e.target.value)}
                                required
                                placeholder="e.g.: Standard cleaning, Boiler inspection, etc."
                                className="w-full bg-[var(--bg-tertiary)] border border-[var(--border-color)] text-[var(--text-main)] rounded-xl px-3 py-2.5 text-sm outline-none focus:border-accent"
                            />
                        </div>

                        <ChecklistStepsEditor
                            description={tmplDescription}
                            onChange={setTmplDescription}
                            contextKey={selectedTemplate?.id ?? "new-template"}
                            label="Pasos del servicio"
                            helpText="Añade las comprobaciones que el equipo debe completar."
                            addLabel="Añadir paso"
                        />

                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1">
                                <label htmlFor="template-price" className="text-xs font-bold uppercase text-[var(--text-muted)]">{dict.tasks.template_dialog.price_label}</label>
                                <input
                                    id="template-price"
                                    type="number"
                                    step="0.01"
                                    value={tmplPrice}
                                    onChange={(e) => setTmplPrice(e.target.value)}
                                    placeholder="0.00"
                                    className="w-full rounded-xl border border-[var(--border-color)] bg-[var(--bg-tertiary)] px-3 py-2.5 font-mono text-sm text-[var(--text-main)] outline-none focus:border-accent"
                                />
                            </div>
                            <div className="space-y-1">
                                <label htmlFor="template-unit" className="text-xs font-bold uppercase text-[var(--text-muted)]">{dict.tasks.template_dialog.unit_label}</label>
                                <select
                                    id="template-unit"
                                    value={tmplUnit}
                                    onChange={(e) => setTmplUnit(e.target.value)}
                                    aria-label={dict.tasks.template_dialog.unit_label}
                                    className="w-full rounded-xl border border-[var(--border-color)] bg-[var(--bg-tertiary)] px-3 py-2.5 text-sm text-[var(--text-main)] outline-none focus:border-accent"
                                >
                                    {UNIT_OPTIONS.map((opt) => (
                                        <option key={opt} value={opt}>{opt}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    </div>

                    <div className={`${taskDialogFooterClass} justify-end`}>
                        <button
                            type="button"
                            onClick={() => setIsTemplateModalOpen(false)}
                            className={taskDialogDangerBtnClass}
                        >
                            {dict.tasks.template_dialog.cancel}
                        </button>
                        <button
                            type="submit"
                            disabled={isSaving}
                            className={taskDialogPrimaryBtnClass}
                        >
                            {isSaving ? (
                                <>
                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                    {dict.tasks.template_dialog.saving}
                                </>
                            ) : (
                                selectedTemplate ? "Save changes" : "Create service"
                            )}
                        </button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}
