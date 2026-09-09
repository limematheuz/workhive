"use client";

import React from "react";
import { Loader2 } from "lucide-react";
import { TemplateTask } from "@/hooks/useTasksPage";
import type { Dictionary } from "@/lib/dictionary-context";
import { ChecklistStepsEditor } from "./ChecklistStepsEditor";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
    tmplPricingMode: "fixed" | "hourly";
    setTmplPricingMode: (val: "fixed" | "hourly") => void;
    tmplDurationMinutes: string;
    setTmplDurationMinutes: (val: string) => void;
    tmplRequirements: string;
    setTmplRequirements: (val: string) => void;
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
    tmplPricingMode,
    setTmplPricingMode,
    tmplDurationMinutes,
    setTmplDurationMinutes,
    tmplRequirements,
    setTmplRequirements,
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
                        {selectedTemplate ? "Editar servicio" : "Nuevo servicio"}
                    </DialogTitle>
                    <DialogDescription className="mt-1 text-xs font-semibold text-[var(--text-muted)]">
                        Define el servicio y las comprobaciones que debe completar el equipo.
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSaveTemplate} className="flex min-h-0 flex-1 flex-col font-sans">
                    <div className={taskDialogBodyClass}>
                        <div className="space-y-1">
                            <Label htmlFor="template-name" className="text-xs uppercase font-bold text-[var(--text-muted)]">{dict.tasks.template_dialog.name_label}</Label>
                            <Input
                                id="template-name"
                                type="text"
                                value={tmplName}
                                onChange={(e) => setTmplName(e.target.value)}
                                required
                                placeholder="Ej.: limpieza estándar, revisión de caldera…"
                                className="h-10 rounded-xl text-sm"
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

                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                            <div className="space-y-1">
                                <Label htmlFor="template-pricing-mode" className="text-xs font-bold uppercase text-[var(--text-muted)]">Modo de cobro</Label>
                                <Select
                                    value={tmplPricingMode}
                                    onValueChange={(value) => {
                                        const mode = value as "fixed" | "hourly";
                                        setTmplPricingMode(mode);
                                        if (mode === "hourly") setTmplUnit("hour");
                                    }}
                                >
                                    <SelectTrigger id="template-pricing-mode"><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="fixed">Precio fijo</SelectItem>
                                        <SelectItem value="hourly">Por horas</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-1">
                                <Label htmlFor="template-price" className="text-xs font-bold uppercase text-[var(--text-muted)]">{dict.tasks.template_dialog.price_label}</Label>
                                <Input
                                    id="template-price"
                                    type="number"
                                    step="0.01"
                                    data-price-input
                                    value={tmplPrice}
                                    onChange={(e) => setTmplPrice(e.target.value)}
                                    placeholder="0.00"
                                    className="h-10 rounded-xl font-mono text-sm"
                                />
                            </div>
                            <div className="space-y-1">
                                <Label htmlFor="template-unit" className="text-xs font-bold uppercase text-[var(--text-muted)]">{dict.tasks.template_dialog.unit_label}</Label>
                                <Select
                                    value={tmplUnit}
                                    onValueChange={setTmplUnit}
                                    disabled={tmplPricingMode === "hourly"}
                                >
                                    <SelectTrigger id="template-unit" aria-label={dict.tasks.template_dialog.unit_label}><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        {UNIT_OPTIONS.map((opt) => (
                                            <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                            <div className="space-y-1">
                                <Label htmlFor="template-duration" className="text-xs font-bold uppercase text-[var(--text-muted)]">Duración estimada (minutos)</Label>
                                <Input
                                    id="template-duration"
                                    type="number"
                                    min="1"
                                    value={tmplDurationMinutes}
                                    onChange={(event) => setTmplDurationMinutes(event.target.value)}
                                    placeholder="Ej.: 90"
                                    className="h-10 rounded-xl font-mono text-sm"
                                />
                            </div>
                            <div className="space-y-1">
                                <Label htmlFor="template-requirements" className="text-xs font-bold uppercase text-[var(--text-muted)]">Requisitos</Label>
                                <Input
                                    id="template-requirements"
                                    value={tmplRequirements}
                                    onChange={(event) => setTmplRequirements(event.target.value)}
                                    placeholder="Ej.: llaves, material y acceso"
                                    className="h-10 rounded-xl text-sm"
                                />
                            </div>
                        </div>
                    </div>

                    <div className={`${taskDialogFooterClass} justify-end`}>
                        <Button
                            type="button"
                            onClick={() => setIsTemplateModalOpen(false)}
                            variant="cancel"
                        >
                            {dict.tasks.template_dialog.cancel}
                        </Button>
                        <Button
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
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}
