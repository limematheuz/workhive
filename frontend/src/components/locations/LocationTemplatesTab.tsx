"use client";

import React, { useState } from "react";
import { ListChecks, Loader2, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type {
    LocationTemplate as HouseTemplate,
    TemplateTask,
} from "@/types/template";
import { useDictionary } from "@/lib/dictionary-context";
import Link from "next/link";
import { InstructionList } from "@/components/ui/instruction-list";
import { ChecklistStepsEditor } from "@/components/tasks/ChecklistStepsEditor";
import { getEffectiveLocationTemplate } from "@/domain/locations/location-template";
import { DeleteConfirmDialog } from "@/components/ui/delete-confirm-dialog";

interface LocationTemplatesTabProps {
    handleLinkTemplates: (e: React.FormEvent) => void;
    selectedGlobalTemplateIds: number[];
    setSelectedGlobalTemplateIds: React.Dispatch<React.SetStateAction<number[]>>;
    availableTemplates: TemplateTask[];
    templatePrices: Record<number, string>;
    setTemplatePrices: React.Dispatch<React.SetStateAction<Record<number, string>>>;
    isLinking: boolean;
    loadingHouseTemplates: boolean;
    houseTemplates: HouseTemplate[];
    globalTemplates: TemplateTask[];
    handleUnlinkTemplate: (templateTaskId: number) => Promise<boolean>;
    readOnly?: boolean;
    editingTemplateId?: number | null;
    setEditingTemplateId?: (id: number | null) => void;
    editingTemplateValues: { name: string; description: string; unit: string; price: string };
    setEditingTemplateValues: React.Dispatch<React.SetStateAction<{ name: string; description: string; unit: string; price: string }>>;
    handleUpdateTemplate: (templateTaskId: number) => void;
}

export function LocationTemplatesTab({
    handleLinkTemplates,
    selectedGlobalTemplateIds,
    setSelectedGlobalTemplateIds,
    availableTemplates,
    templatePrices,
    setTemplatePrices,
    isLinking,
    loadingHouseTemplates,
    houseTemplates,
    globalTemplates,
    handleUnlinkTemplate,
    readOnly = false,
    editingTemplateId = null,
    setEditingTemplateId,
    editingTemplateValues,
    setEditingTemplateValues,
    handleUpdateTemplate,
}: LocationTemplatesTabProps) {
    const { dict } = useDictionary();
    const selectedGlobalTemplateIdSet = new Set(selectedGlobalTemplateIds);
    const [templateToUnlink, setTemplateToUnlink] = useState<number | null>(null);
    const [isUnlinking, setIsUnlinking] = useState(false);

    const confirmUnlink = async () => {
        if (templateToUnlink === null) return;
        try {
            setIsUnlinking(true);
            const wasUnlinked = await handleUnlinkTemplate(templateToUnlink);
            if (wasUnlinked) setTemplateToUnlink(null);
        } finally {
            setIsUnlinking(false);
        }
    };

    return (
        <>
        <div className="space-y-6">
            <div className="rounded-xl border border-accent/20 bg-accent/5 px-4 py-3">
                <p className="text-sm font-semibold text-[var(--text-main)]">
                    {readOnly
                        ? (dict.locations?.sheet?.services_required_title || "Services required by the owning company")
                        : (dict.locations?.sheet?.services_permanent_title || "Permanent services of this location")}
                </p>
                <p className="mt-1 text-sm leading-5 text-[var(--text-muted)]">
                    {readOnly
                        ? (dict.locations?.sheet?.services_required_desc || "These requirements will be included in service requests. You can view them, but only the owning company can modify them.")
                        : (dict.locations?.sheet?.services_permanent_desc || "Link services from your catalog. They will be automatically included when generating a job and will never mix with another company's catalog.")}
                </p>
            </div>
            {!readOnly && (
                <form onSubmit={handleLinkTemplates} className="bg-[var(--bg-secondary)] p-4 border border-[var(--border-soft)] rounded-xl space-y-4">
                    <h4 className="text-sm font-bold text-[var(--text-main)] flex items-center gap-2">
                        <ListChecks className="w-4 h-4 text-accent" />
                        {dict.locations?.sheet?.add_catalog_service || "Add service from catalog"}
                    </h4>

                    <div className="space-y-2">
                        <Label className="text-xs font-semibold text-[var(--text-muted)]">{dict.locations?.sheet?.service_label || "Service"}</Label>
                        {availableTemplates.length === 0 ? (
                            <div className="rounded-lg border border-dashed border-[var(--border-soft)] bg-[var(--bg-card)] px-3 py-3 text-sm text-[var(--text-muted)]">
                                {globalTemplates.length === 0
                                    ? (dict.locations?.sheet?.no_catalog_services || "There are no active services in your catalog yet. Create it in Tasks > Catalog and return here to link it.")
                                    : (dict.locations?.sheet?.all_catalog_linked || "All services from your catalog are already linked to this location.")}
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {availableTemplates.map(template => {
                                    const selected = selectedGlobalTemplateIdSet.has(template.id);
                                    return (
                                        <div key={template.id} className="grid gap-3 rounded-xl border border-[var(--border-soft)] bg-[var(--bg-card)] p-3 sm:grid-cols-[minmax(0,1fr)_10rem] sm:items-center">
                                            <label htmlFor={`location-template-${template.id}`} className="flex min-w-0 flex-1 cursor-pointer items-center gap-3">
                                                <Checkbox
                                                    id={`location-template-${template.id}`}
                                                    checked={selected}
                                                    onCheckedChange={() => setSelectedGlobalTemplateIds(ids => selected
                                                        ? ids.filter(id => id !== template.id)
                                                        : [...ids, template.id])}
                                                    className="h-4 w-4"
                                                />
                                                <span className="min-w-0 flex-1">
                                                    <span className="block truncate text-sm font-bold text-[var(--text-main)]">{template.name}</span>
                                                    <span className="text-xs text-[var(--text-muted)]">{template.default_price ?? 0} € / {template.unit}</span>
                                                </span>
                                            </label>
                                            <Input
                                                type="number"
                                                aria-label={`${template.name} ${dict.locations?.sheet?.price_short_placeholder || "Local price"}`}
                                                step="0.01"
                                                data-price-input
                                                value={templatePrices[template.id] || ""}
                                                onClick={event => event.stopPropagation()}
                                                onChange={event => setTemplatePrices(prices => ({ ...prices, [template.id]: event.target.value }))}
                                                placeholder={dict.locations?.sheet?.price_short_placeholder || "Local price"}
                                                className="h-9 w-full bg-[var(--bg-secondary)] text-xs text-[var(--text-main)] focus-visible:border-accent"
                                            />
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    {globalTemplates.length === 0 ? (
                        <Button asChild className="w-full rounded-lg bg-[var(--btn-primary-bg)] text-sm font-semibold text-[var(--btn-primary-text)] hover:bg-[var(--btn-primary-hover-bg)]">
                            <Link href="/dashboard/tasks?tab=templates">{dict.locations?.sheet?.go_to_catalog || "Go to service catalog"}</Link>
                        </Button>
                    ) : (
                        <>
                            <Button
                                type="submit"
                                disabled={isLinking || selectedGlobalTemplateIds.length === 0}
                                className="w-full bg-[var(--btn-primary-bg)] text-[var(--btn-primary-text)] hover:bg-[var(--btn-primary-hover-bg)] rounded-lg py-2.5 text-sm font-semibold flex items-center justify-center gap-2 border-none cursor-pointer"
                            >
                                {isLinking ? (
                                    <>
                                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                        {dict.locations?.sheet?.associating || "Linking..."}
                                    </>
                                ) : (
                                    `${dict.locations?.sheet?.associate_btn || "Link service"} (${selectedGlobalTemplateIds.length})`
                                )}
                            </Button>
                        </>
                    )}
                </form>
            )}

            <div>
                <h4 className="text-sm font-bold text-[var(--text-main)] mb-3 pb-2 border-b border-[var(--border-soft)]">
                    {readOnly ? (dict.locations?.sheet?.defined_services || "Defined services") : (dict.locations?.sheet?.linked_services || "Linked services")} ({houseTemplates.length})
                </h4>

                {loadingHouseTemplates ? (
                    <div className="flex items-center justify-center py-6 gap-2">
                        <Loader2 className="w-4 h-4 animate-spin text-accent" />
                        <span className="text-2xs text-[var(--text-muted)] font-semibold">{dict.locations?.sheet?.loading_checklist || "Loading fixed checklist..."}</span>
                    </div>
                ) : houseTemplates.length > 0 ? (
                    <div className="space-y-2">
                        {houseTemplates.map(ht => {
                            const tmpl = ht.template || globalTemplates.find(g => g.id === ht.template_task_id);
                            const effective = getEffectiveLocationTemplate(ht, tmpl);
                            const priceText = ht.custom_price !== null
                                ? (dict.locations?.sheet?.price_house?.replace("{price}", ht.custom_price.toString()).replace("{unit}", effective.unit) || `${ht.custom_price} € / ${effective.unit} (Local price)`)
                                : (tmpl && tmpl.default_price !== null && tmpl.default_price !== undefined)
                                    ? (dict.locations?.sheet?.price_base?.replace("{price}", tmpl.default_price.toString()).replace("{unit}", effective.unit) || `${tmpl.default_price} € / ${effective.unit} (Base price)`)
                                    : (dict.locations?.sheet?.price_none || "No price configured");

                            const isEditing = editingTemplateId === ht.template_task_id;

                            return (
                                <div
                                    key={ht.template_task_id}
                                    className="flex items-start justify-between gap-3 p-4 rounded-xl border border-[var(--border-soft)] bg-[var(--bg-secondary)]"
                                >
                                    <div className="min-w-0 flex-1">
                                        {!isEditing && <span className="text-sm font-bold text-[var(--text-main)] block">{effective.name || `Template #${ht.template_task_id}`}</span>}
                                        {!isEditing && effective.description && (
                                            <InstructionList
                                                description={effective.description}
                                                className="mt-3"
                                            />
                                        )}
                                        {isEditing ? (
                                            <div className="space-y-2">
                                                <Input
                                                    value={editingTemplateValues.name}
                                                    onChange={event => setEditingTemplateValues(values => ({ ...values, name: event.target.value }))}
                                                    placeholder={tmpl?.name}
                                                    className="h-9 w-full rounded-lg border border-[var(--border-color)] bg-[var(--bg-card)] px-2.5 text-xs text-[var(--text-main)]"
                                                />
                                                <ChecklistStepsEditor
                                                    description={editingTemplateValues.description}
                                                    onChange={(description) => setEditingTemplateValues((values) => ({ ...values, description }))}
                                                    contextKey={ht.template_task_id}
                                                    label="Pasos del servicio"
                                                    helpText="Los pasos se muestran como checklist al crear y ejecutar una tarea."
                                                    addLabel="Añadir paso"
                                                />
                                                <div className="grid grid-cols-2 gap-2">
                                                <label className="space-y-1">
                                                    <span className="block text-2xs font-black uppercase tracking-wider text-[var(--text-muted)]">Precio (€)</span>
                                                    <Input
                                                        type="number"
                                                        step="0.01"
                                                        data-price-input
                                                        value={editingTemplateValues.price}
                                                        onChange={event => setEditingTemplateValues(values => ({ ...values, price: event.target.value }))}
                                                        placeholder={tmpl?.default_price?.toString() || "0.00"}
                                                        className="h-10 w-full bg-[var(--bg-card)] border border-[var(--border-color)] text-[var(--text-main)] rounded-xl px-3 text-sm outline-none focus:border-accent"
                                                    />
                                                </label>
                                                <label className="space-y-1">
                                                    <span className="block text-2xs font-black uppercase tracking-wider text-[var(--text-muted)]">Unidad</span>
                                                    <Input
                                                        value={editingTemplateValues.unit}
                                                        onChange={event => setEditingTemplateValues(values => ({ ...values, unit: event.target.value }))}
                                                        placeholder={tmpl?.unit || "servicio"}
                                                        className="h-10 w-full rounded-xl border border-[var(--border-color)] bg-[var(--bg-card)] px-3 text-sm text-[var(--text-main)] outline-none focus:border-accent"
                                                    />
                                                </label>
                                                </div>
                                                <div className="flex flex-wrap items-center gap-2">
                                                <button
                                                    type="button"
                                                    onClick={() => handleUpdateTemplate(ht.template_task_id)}
                                                    className="h-9 rounded-xl bg-accent px-3.5 py-1 text-xs font-bold text-white hover:bg-[var(--accent-light-color)] border-none cursor-pointer"
                                                >
                                                    {dict.locations?.form?.price_save || "Save"}
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => setEditingTemplateId?.(null)}
                                                    className="h-9 rounded-xl px-3 py-1 text-xs font-semibold text-[var(--text-muted)] hover:bg-[var(--bg-tertiary)] border-none cursor-pointer"
                                                >
                                                    {dict.locations?.form?.price_cancel || "Cancel"}
                                                </button>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="flex items-center gap-2 mt-2">
                                                <span className="text-xs text-[var(--text-muted)] font-semibold block">
                                                    {priceText}
                                                </span>
                                                {!readOnly && (
                                                    <button type="button"
                                                        onClick={() => {
                                                            setEditingTemplateId?.(ht.template_task_id);
                                                            setEditingTemplateValues({
                                                                name: ht.custom_name || "",
                                                                description: ht.custom_description ?? tmpl?.description ?? "",
                                                                unit: ht.custom_unit || "",
                                                                price: ht.custom_price?.toString() || "",
                                                            });
                                                        }}
                                                        className="inline-flex items-center gap-1 text-[10px] text-accent hover:underline font-bold uppercase tracking-wider cursor-pointer"
                                                    >
                                                        <Pencil className="h-3 w-3" />
                                                        {dict.locations?.form?.fixed_task_edit || "Edit fixed task"}
                                                    </button>
                                                )}
                                            </div>
                                        )}
                                    </div>

                                    {!readOnly && !isEditing && (
                                        <button type="button"
                                            onClick={() => setTemplateToUnlink(ht.template_task_id)}
                                            className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-[var(--btn-cancel-border)] px-2.5 py-2 text-[10px] font-bold uppercase tracking-wide text-[var(--btn-cancel-text)] hover:bg-[var(--btn-cancel-bg)] ui-motion cursor-pointer self-start"
                                            title={dict.locations?.sheet?.unlink_tooltip || "Remove from this property"}
                                            aria-label={dict.locations?.sheet?.unlink_tooltip || "Remove from this property"}
                                        >
                                            <Trash2 className="w-4 h-4" />
                                            <span>{dict.locations?.sheet?.unlink_tooltip || "Remove from this property"}</span>
                                        </button>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    <div className="text-center py-10 bg-[var(--bg-secondary)] rounded-2xl border border-[var(--border-soft)]">
                        <p className="text-sm text-[var(--text-muted)] font-semibold">
                            {readOnly
                                ? (dict.locations?.sheet?.no_owner_services || "The owning company has not defined fixed services for this location yet.")
                                : (dict.locations?.sheet?.no_house_templates || "This local has no fixed tasks associated yet.")}
                        </p>
                    </div>
                )}
            </div>
        </div>
        <DeleteConfirmDialog
            open={templateToUnlink !== null}
            onOpenChange={(open) => !open && setTemplateToUnlink(null)}
            title={dict.locations?.sheet?.unlink_confirm_title || "Remove fixed task from this location"}
            description={dict.locations?.sheet?.unlink_confirm_description
                || "This only unlinks the service from this location. The global template and existing jobs will not be deleted."}
            onConfirm={() => void confirmUnlink()}
            isDeleting={isUnlinking}
            confirmText={dict.locations?.sheet?.unlink_confirm_button || "Remove from location"}
            cancelText={dict.locations?.sheet?.cancel || "Cancel"}
            confirmVariant="soft-danger"
        />
        </>
    );
}
