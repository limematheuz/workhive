"use client";

import { useState } from "react";
import { toast } from "@/lib/toast";
import { TemplateTaskService, type TemplateTaskInput } from "@/services/template.service";
import type { TemplateTask } from "@/types/template";
import type { Dictionary } from "@/lib/dictionary-context";
import { getErrorMessage } from "@/lib/errors";

interface UseTemplateCrudParams {
    dict: Dictionary;
    setTemplates: React.Dispatch<React.SetStateAction<TemplateTask[]>>;
}

export function useTemplateCrud({ dict, setTemplates }: UseTemplateCrudParams) {
    const [isTemplateModalOpen, setIsTemplateModalOpen] = useState<boolean>(false);
    const [tmplName, setTmplName] = useState<string>("");
    const [tmplDescription, setTmplDescription] = useState<string>("");
    const [tmplPrice, setTmplPrice] = useState<string>("");
    const [tmplUnit, setTmplUnit] = useState<string>("unidad");
    const [tmplPricingMode, setTmplPricingMode] = useState<"fixed" | "hourly">("fixed");
    const [tmplDurationMinutes, setTmplDurationMinutes] = useState<string>("");
    const [tmplRequirements, setTmplRequirements] = useState<string>("");
    const [isDeletingTemplate, setIsDeletingTemplate] = useState<boolean>(false);
    const [selectedTemplate, setSelectedTemplate] = useState<TemplateTask | null>(null);

    const handleSaveTemplate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!tmplName.trim()) return;

        try {
            const payload: TemplateTaskInput = {
                name: tmplName,
                description: tmplDescription || null,
                default_price: (tmplPrice !== "" && tmplPrice !== null && tmplPrice !== undefined) ? parseFloat(tmplPrice) : null,
                unit: tmplPricingMode === "hourly" ? "hour" : tmplUnit,
                pricing_mode: tmplPricingMode,
                estimated_duration_minutes: tmplDurationMinutes ? Number(tmplDurationMinutes) : null,
                requirements: tmplRequirements.trim() || null,
            };

            if (selectedTemplate) {
                await TemplateTaskService.updateTemplate(selectedTemplate.id, payload);
                toast.success("Plantilla actualizada con éxito.");
            } else {
                await TemplateTaskService.createTemplate(payload);
                toast.success("Plantilla creada con éxito.");
            }

            const freshTemplates = await TemplateTaskService.getTemplates();
            setTemplates(freshTemplates);
            setIsTemplateModalOpen(false);
            setSelectedTemplate(null);
        } catch (error: unknown) {
            console.error("Error saving template", error);
            toast.error(getErrorMessage(error, "Error operativo con plantillas"));
        }
    };

    const handleOpenTemplateModal = (template: TemplateTask | null) => {
        setSelectedTemplate(template);
        if (template) {
            setTmplName(template.name);
            setTmplDescription(template.description || "");
            setTmplPrice(template.default_price !== null && template.default_price !== undefined ? template.default_price.toString() : "");
            setTmplUnit(template.unit || "unidad");
            setTmplPricingMode(template.pricing_mode === "hourly" ? "hourly" : "fixed");
            setTmplDurationMinutes(template.estimated_duration_minutes?.toString() ?? "");
            setTmplRequirements(template.requirements ?? "");
        } else {
            setTmplName("");
            setTmplDescription("");
            setTmplPrice("");
            setTmplUnit("unidad");
            setTmplPricingMode("fixed");
            setTmplDurationMinutes("");
            setTmplRequirements("");
        }
        setIsTemplateModalOpen(true);
    };

    const handleDeleteTemplate = async (templateId: number) => {
        try {
            setIsDeletingTemplate(true);
            await TemplateTaskService.deleteTemplate(templateId);
            toast.success(dict.tasks?.delete_template_success || "Plantilla eliminada con éxito.");

            const freshTemplates = await TemplateTaskService.getTemplates();
            setTemplates(freshTemplates);
        } catch (error: unknown) {
            console.error("Error deleting template", error);
            toast.error(getErrorMessage(error, "Error al eliminar la plantilla"));
        } finally {
            setIsDeletingTemplate(false);
        }
    };

    const handleDuplicateTemplate = async (template: TemplateTask) => {
        try {
            const payload: TemplateTaskInput = {
                name: `${template.name} (Copia)`,
                description: template.description || null,
                default_price: template.default_price !== null && template.default_price !== undefined ? template.default_price : null,
                unit: template.unit,
                pricing_mode: template.pricing_mode === "hourly" ? "hourly" : "fixed",
                estimated_duration_minutes: template.estimated_duration_minutes ?? null,
                requirements: template.requirements ?? null,
            };

            await TemplateTaskService.createTemplate(payload);
            toast.success("Plantilla duplicada con éxito.");

            const freshTemplates = await TemplateTaskService.getTemplates();
            setTemplates(freshTemplates);
        } catch (error: unknown) {
            console.error("Error duplicating template", error);
            toast.error(getErrorMessage(error, "Error al duplicar la plantilla"));
        }
    };

    return {
        isTemplateModalOpen,
        setIsTemplateModalOpen,
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
        isDeletingTemplate,
        selectedTemplate,
        setSelectedTemplate,
        handleSaveTemplate,
        handleOpenTemplateModal,
        handleDeleteTemplate,
        handleDuplicateTemplate,
    };
}
