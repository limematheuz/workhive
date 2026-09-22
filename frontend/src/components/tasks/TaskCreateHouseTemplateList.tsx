"use client";

import { useState } from "react";
import { Check, ChevronDown, UsersRound } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getEffectiveLocationTemplate } from "@/domain/locations/location-template";
import type { Dictionary } from "@/lib/dictionary-context";
import {
    pricingValuesForTaskCreation,
    type TaskCreationPricingOverride,
} from "@/lib/task-pricing";
import type { HouseTemplate, TemplateTask } from "@/hooks/useTasksPage";
import type { User } from "@/types/user";

import { ALL_WORKERS_VALUE, parseChecklist } from "./taskCreateChecklist";

interface TaskCreateHouseTemplateListProps {
    dict: Dictionary;
    users: User[];
    templates: TemplateTask[];
    visibleHouseTemplates: HouseTemplate[];
    selectedHouseTemplateId: number | null;
    useHouseChecklist: boolean;
    selectHouseTemplate: (id: number) => void;
    fixedChecklistAssignments: Record<string, string>;
    setFixedChecklistAssignments: React.Dispatch<React.SetStateAction<Record<string, string>>>;
    taskPricingOverrides: Record<number, TaskCreationPricingOverride>;
    setTaskPricingOverrides: React.Dispatch<React.SetStateAction<Record<number, TaskCreationPricingOverride>>>;
    defaultAssigneeId: string;
    setDefaultAssigneeId: (value: string) => void;
}

export function TaskCreateHouseTemplateList({
    dict,
    users,
    templates,
    visibleHouseTemplates,
    selectedHouseTemplateId,
    useHouseChecklist,
    selectHouseTemplate,
    fixedChecklistAssignments,
    setFixedChecklistAssignments,
    taskPricingOverrides,
    setTaskPricingOverrides,
    defaultAssigneeId,
    setDefaultAssigneeId,
}: TaskCreateHouseTemplateListProps) {
    const [expandedTemplateIds, setExpandedTemplateIds] = useState<Set<number>>(new Set());
    const toggleTemplateExpanded = (templateId: number) => {
        setExpandedTemplateIds((current) => {
            const next = new Set(current);
            if (next.has(templateId)) {
                next.delete(templateId);
            } else {
                next.add(templateId);
            }
            return next;
        });
    };

    return (
        <div
            role="radiogroup"
            aria-label="Servicio para el trabajo"
            className={`space-y-3 transition-opacity ${useHouseChecklist ? "opacity-100" : "opacity-40"}`}
        >
            <div className="rounded-2xl border border-accent/20 bg-accent/5 p-3 sm:flex sm:items-center sm:justify-between sm:gap-4">
                <div className="flex items-start gap-2">
                    <UsersRound className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
                    <div>
                        <p className="text-xs font-black text-[var(--text-main)]">Asignación rápida</p>
                        <p className="mt-0.5 text-2xs leading-relaxed text-[var(--text-muted)]">
                            Se aplica a todos los pasos. Puedes cambiar una persona concreta al desplegar el servicio.
                        </p>
                    </div>
                </div>
                <label className="mt-3 block shrink-0 sm:mt-0 sm:w-52" htmlFor="task-create-default-assignee">
                    <span className="sr-only">Asignar todos los pasos a</span>
                    <Select
                        value={defaultAssigneeId || "none"}
                        disabled={!useHouseChecklist}
                        onValueChange={(value) => setDefaultAssigneeId(value === "none" ? "" : value)}
                    >
                        <SelectTrigger id="task-create-default-assignee" className="h-10 w-full text-xs font-bold"><SelectValue /></SelectTrigger>
                        <SelectContent><SelectItem value="none">Sin asignar por defecto</SelectItem><SelectItem value={ALL_WORKERS_VALUE}>Todo el equipo</SelectItem>{users.map((user) => <SelectItem key={user.id} value={user.id.toString()}>{user.full_name || user.email}</SelectItem>)}</SelectContent>
                    </Select>
                </label>
            </div>

            {visibleHouseTemplates.map((houseTemplate) => {
                const template = templates.find((item) => item.id === houseTemplate.template_task_id);
                const effective = getEffectiveLocationTemplate(houseTemplate, template);
                const isChecked = selectedHouseTemplateId === houseTemplate.template_task_id;
                const isExpanded = expandedTemplateIds.has(houseTemplate.template_task_id);
                const subItems = effective.description ? parseChecklist(effective.description) : [];
                const pricingValues = taskPricingOverrides[houseTemplate.template_task_id]
                    || pricingValuesForTaskCreation(effective);
                const selectedPrice = pricingValues.price.trim() === ""
                    ? null
                    : Number(pricingValues.price);
                const priceLabel = selectedPrice === null || !Number.isFinite(selectedPrice)
                    ? "Precio pendiente"
                    : `${selectedPrice} € / ${pricingValues.pricingMode === "hourly" ? "hora" : effective.unit}`;
                const pricingSourceNote = isChecked
                    ? (dict.tasks?.create_dialog?.task_pricing_saved_note || "Se guardará solo en este trabajo")
                    : houseTemplate.custom_price !== null
                        ? (dict.tasks?.create_dialog?.custom_price_note || "(Custom price)")
                        : (dict.tasks?.create_dialog?.base_price_note || "(Base price)");

                const updatePricing = (patch: Partial<TaskCreationPricingOverride>) => {
                    setTaskPricingOverrides((current) => ({
                        ...current,
                        [houseTemplate.template_task_id]: {
                            ...pricingValues,
                            ...patch,
                        },
                    }));
                };

                return (
                    <div
                        key={houseTemplate.template_task_id}
                        className={`overflow-hidden rounded-2xl border ui-motion duration-200 ${
                            isChecked && useHouseChecklist
                                ? "border-[var(--border-soft)] bg-[var(--bg-primary)]/30"
                                : "border-[var(--border-soft)]/50 bg-[var(--bg-secondary)]"
                        }`}
                    >
                        <div className="flex items-center gap-2.5 p-3">
                            <button
                                type="button"
                                disabled={!useHouseChecklist}
                                onClick={() => useHouseChecklist && selectHouseTemplate(houseTemplate.template_task_id)}
                                role="radio"
                                aria-checked={isChecked}
                                aria-label={`Seleccionar ${effective.name}`}
                                className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ui-motion ${
                                    isChecked && useHouseChecklist
                                        ? "border-accent bg-accent text-white"
                                        : "border-[var(--border-color)] bg-[var(--bg-card)]"
                                } ${useHouseChecklist ? "cursor-pointer" : "cursor-default"}`}
                            >
                                {isChecked && useHouseChecklist && <Check className="h-2.5 w-2.5 stroke-[3px]" />}
                            </button>
                            <div className="min-w-0 flex-1">
                                <span className="block truncate text-xs font-bold text-[var(--text-main)]">{effective.name}</span>
                                <span className="text-[10px] font-semibold text-accent">
                                    {pricingValues.pricingMode === "hourly" ? "Por horas" : "Precio fijo"} · {priceLabel}
                                    <span className="ml-1 text-[var(--text-muted)]">
                                        {pricingSourceNote}
                                    </span>
                                </span>
                            </div>
                            {subItems.length > 0 && (
                                <button
                                    type="button"
                                    onClick={() => toggleTemplateExpanded(houseTemplate.template_task_id)}
                                    className="flex shrink-0 cursor-pointer items-center gap-1 rounded-lg px-2 py-1 text-[10px] font-bold text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-main)]"
                                >
                                    <span>{subItems.length} {subItems.length === 1 ? "paso" : "pasos"}</span>
                                    <ChevronDown className={`h-3.5 w-3.5 transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}`} />
                                </button>
                            )}
                        </div>
                        {isChecked && useHouseChecklist && (
                            <div className="border-t border-[var(--border-soft)]/60 bg-[var(--bg-primary)]/20 px-3 py-2.5">
                                <div className="flex flex-wrap items-center gap-2.5">
                                    <span className="text-[10px] font-bold uppercase tracking-wide text-[var(--text-muted)]">
                                        {dict.tasks?.create_dialog?.task_pricing_mode || "Facturación"}
                                    </span>
                                <div
                                    role="group"
                                    aria-label={`${dict.tasks?.create_dialog?.task_pricing_mode || "Modalidad de facturación"}: ${effective.name}`}
                                    className="flex shrink-0 rounded-lg border border-[var(--border-soft)] bg-[var(--bg-card)] p-0.5 shadow-sm"
                                >
                                    {(["fixed", "hourly"] as const).map((mode) => {
                                        const active = pricingValues.pricingMode === mode;
                                        const label = mode === "fixed"
                                            ? (dict.tasks?.create_dialog?.fixed_price || "Precio fijo")
                                            : (dict.tasks?.create_dialog?.hourly_rate || "Por hora");
                                        return (
                                            <button
                                                key={mode}
                                                type="button"
                                                aria-pressed={active}
                                                onClick={() => updatePricing({ pricingMode: mode })}
                                                className={`h-7 rounded-md px-2.5 text-[10px] font-bold ui-motion ${
                                                    active
                                                        ? "bg-accent text-white shadow-sm"
                                                        : "text-[var(--text-muted)] hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-main)]"
                                                }`}
                                            >
                                                {label}
                                            </button>
                                        );
                                    })}
                                </div>
                                <div className="flex items-end gap-2 md:ml-auto">
                                    <label className="block">
                                        <span className="mb-1 block text-[9px] font-bold uppercase tracking-wide text-[var(--text-muted)]">
                                            {dict.tasks?.create_dialog?.task_price || "Tarifa"}
                                        </span>
                                        <Input
                                            type="text"
                                            inputMode="decimal"
                                            pattern="[0-9]*[.,]?[0-9]*"
                                            data-price-input
                                            value={pricingValues.price}
                                            onChange={(event) => updatePricing({ price: event.target.value })}
                                            aria-label={`${dict.tasks?.create_dialog?.task_price || "Tarifa"}: ${effective.name}`}
                                            className="dialog-compact-control h-9 w-24 px-3 text-center text-sm font-bold sm:w-28"
                                        />
                                    </label>
                                    <span className="pb-2 text-xs font-semibold text-[var(--text-muted)]">
                                        € / {pricingValues.pricingMode === "hourly" ? (dict.tasks?.create_dialog?.hour || "hora") : effective.unit}
                                    </span>
                                </div>
                            </div>
                            </div>
                        )}
                        {isExpanded && subItems.length > 0 && (
                            <div className="space-y-2 border-t border-[var(--border-soft)]/60 bg-[var(--bg-primary)]/10 px-3 py-2.5">
                                {subItems.map((item) => (
                                    <div key={item.index} className="flex items-center justify-between gap-3">
                                        <div className="flex min-w-0 items-center gap-2">
                                            <div className="h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--text-muted)]/40" />
                                            <span className="truncate text-xs font-medium text-[var(--text-main)]">{item.text}</span>
                                        </div>
                                        <Select
                                            value={fixedChecklistAssignments[`${houseTemplate.template_task_id}-${item.index}`] || "unassigned"}
                                            onValueChange={(value) => setFixedChecklistAssignments((current) => ({
                                                ...current,
                                                [`${houseTemplate.template_task_id}-${item.index}`]: value,
                                            }))}
                                        >
                                            <SelectTrigger aria-label={`Asignar trabajador: ${item.text}`} className="h-8 max-w-[140px] shrink-0 rounded-full px-2.5 text-[10px]"><SelectValue /></SelectTrigger>
                                            <SelectContent><SelectItem value="unassigned">-- Sin asignar --</SelectItem><SelectItem value={ALL_WORKERS_VALUE}>{dict.tasks?.create_dialog?.assignee_all || "Todos los trabajadores"}</SelectItem>{users.map((user) => <SelectItem key={user.id} value={user.id.toString()}>{user.full_name || user.email}</SelectItem>)}</SelectContent>
                                        </Select>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
}
