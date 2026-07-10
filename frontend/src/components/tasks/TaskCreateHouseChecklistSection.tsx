"use client";

import React, { useState } from "react";
import { Check, ChevronDown, ListTodo, Loader2 } from "lucide-react";
import type { Dictionary } from "@/lib/dictionary-context";
import { getEffectiveLocationTemplate } from "@/domain/locations/location-template";
import type { TemplateTask, HouseTemplate } from "@/hooks/useTasksPage";
import type { User } from "@/types/user";
import { ALL_WORKERS_VALUE, parseChecklist } from "./taskCreateChecklist";

type TaskCreateHouseChecklistSectionProps = {
    dict: Dictionary;
    isAdminOrManager: boolean;
    users: User[];
    templates: TemplateTask[];
    houseTemplates: HouseTemplate[];
    visibleHouseTemplates: HouseTemplate[];
    loadingHouseTemplates: boolean;
    selectedHouseTemplateIds: number[];
    useHouseChecklist: boolean;
    setUseHouseChecklist: (use: boolean) => void;
    toggleHouseTemplateSelection: (id: number) => void;
    availableTemplates: TemplateTask[];
    handleLinkHouseTemplate: (templateTaskId: number, customPrice: number | null) => Promise<void>;
    fixedChecklistAssignments: Record<string, string>;
    setFixedChecklistAssignments: React.Dispatch<React.SetStateAction<Record<string, string>>>;
};

export function TaskCreateHouseChecklistSection({
    dict,
    isAdminOrManager,
    users,
    templates,
    visibleHouseTemplates,
    loadingHouseTemplates,
    selectedHouseTemplateIds,
    useHouseChecklist,
    setUseHouseChecklist,
    toggleHouseTemplateSelection,
    availableTemplates,
    handleLinkHouseTemplate,
    fixedChecklistAssignments,
    setFixedChecklistAssignments,
}: TaskCreateHouseChecklistSectionProps) {
    const [selectedTmplId, setSelectedTmplId] = useState("");
    const [customPriceVal, setCustomPriceVal] = useState("");
    const [isLinking, setIsLinking] = useState(false);
    const [showQuickAddFixed, setShowQuickAddFixed] = useState(false);
    const [expandedTemplateIds, setExpandedTemplateIds] = useState<Set<number>>(new Set());

    const toggleTemplateExpanded = (templateId: number) => {
        setExpandedTemplateIds(prev => {
            const next = new Set(prev);
            if (next.has(templateId)) {
                next.delete(templateId);
            } else {
                next.add(templateId);
            }
            return next;
        });
    };

    const selectedHouseTemplateIdSet = new Set(selectedHouseTemplateIds);

    return (
        <div className="space-y-2.5">
            <div className="flex items-center justify-between border-b border-[var(--border-soft)] pb-1.5">
                <span className="text-2xs uppercase font-black text-[var(--text-main)] flex items-center gap-1.5">
                    <ListTodo className="w-4 h-4 text-accent" />
                    {dict.tasks?.create_dialog?.fixed_tasks?.replace("{count}", visibleHouseTemplates.length.toString()) || `Default Location Tasks (${visibleHouseTemplates.length})`}
                </span>
                <div className="flex items-center gap-3">
                    {isAdminOrManager && availableTemplates.length > 0 && (
                        <button
                            type="button"
                            onClick={() => setShowQuickAddFixed(!showQuickAddFixed)}
                            className="text-2xs font-bold uppercase text-accent hover:underline cursor-pointer"
                        >
                            {showQuickAddFixed ? (dict.tasks?.create_dialog?.cancel_link || "Cancel") : ("+ Link Default Task")}
                        </button>
                    )}
                    {visibleHouseTemplates.length > 0 && (
                        <div className="flex items-center gap-2">
                            <input
                                type="checkbox"
                                id="toggleChecklist"
                                checked={useHouseChecklist}
                                onChange={(e) => setUseHouseChecklist(e.target.checked)}
                                className="w-3.5 h-3.5 rounded border-[var(--border-color)] bg-[var(--bg-card)] text-accent focus:ring-accent accent-accent cursor-pointer animate-none"
                            />
                            <label htmlFor="toggleChecklist" className="text-2xs font-bold uppercase text-[var(--text-muted)] cursor-pointer">
                                {dict.tasks?.create_dialog?.create_checklist || "Create checklist"}
                            </label>
                        </div>
                    )}
                </div>
            </div>

            {loadingHouseTemplates ? (
                <div className="flex items-center gap-2 py-4 justify-center">
                    <Loader2 className="w-4 h-4 animate-spin text-accent" />
                    <span className="text-2xs text-[var(--text-muted)] font-semibold">{dict.tasks?.create_dialog?.searching_fixed_tasks || "Searching default tasks..."}</span>
                </div>
            ) : visibleHouseTemplates.length > 0 ? (
                <div className={`space-y-1.5 transition-opacity ${useHouseChecklist ? "opacity-100" : "opacity-40"}`}>
                    {visibleHouseTemplates.map(ht => {
                        const tmpl = templates.find(t => t.id === ht.template_task_id);
                        const effective = getEffectiveLocationTemplate(ht, tmpl);
                        const isChecked = selectedHouseTemplateIdSet.has(ht.template_task_id);
                        const isExpanded = expandedTemplateIds.has(ht.template_task_id);
                        const price = effective.price ?? 0;
                        const subItems = effective.description ? parseChecklist(effective.description) : [];
                        return (
                            <div
                                key={ht.template_task_id}
                                className={`rounded-2xl border transition-all duration-200 overflow-hidden ${
                                    isChecked && useHouseChecklist
                                        ? "border-[var(--border-soft)] bg-[var(--bg-primary)]/30"
                                        : "border-[var(--border-soft)]/50 bg-[var(--bg-secondary)]"
                                }`}
                            >
                                <div className="flex items-center gap-2.5 p-3">
                                    <button
                                        type="button"
                                        disabled={!useHouseChecklist}
                                        onClick={() => useHouseChecklist && toggleHouseTemplateSelection(ht.template_task_id)}
                                        aria-label={`Seleccionar ${effective.name}`}
                                        className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-all ${
                                            isChecked && useHouseChecklist
                                                ? "bg-accent border-accent text-white"
                                                : "border-[var(--border-color)] bg-[var(--bg-card)]"
                                        } ${useHouseChecklist ? "cursor-pointer" : "cursor-default"}`}
                                    >
                                        {isChecked && useHouseChecklist && <Check className="w-2.5 h-2.5 stroke-[3px]" />}
                                    </button>

                                    <div className="flex-1 min-w-0">
                                        <span className="text-xs font-bold text-[var(--text-main)] block truncate">
                                            {effective.name}
                                        </span>
                                        <span className="text-[10px] font-semibold text-accent">
                                            {price} € / {effective.unit}
                                            <span className="text-[var(--text-muted)] ml-1">
                                                {ht.custom_price !== null ? (dict.tasks?.create_dialog?.custom_price_note || "(Custom price)") : (dict.tasks?.create_dialog?.base_price_note || "(Base price)")}
                                            </span>
                                        </span>
                                    </div>

                                    {subItems.length > 0 && (
                                        <button
                                            type="button"
                                            onClick={() => toggleTemplateExpanded(ht.template_task_id)}
                                            className="flex items-center gap-1 text-[10px] font-bold text-[var(--text-muted)] hover:text-[var(--text-main)] transition-colors cursor-pointer shrink-0 px-2 py-1 rounded-lg hover:bg-[var(--bg-tertiary)]"
                                        >
                                            <span>{subItems.length} {subItems.length === 1 ? "paso" : "pasos"}</span>
                                            <ChevronDown
                                                className={`w-3.5 h-3.5 transition-transform duration-200 ${
                                                    isExpanded ? "rotate-180" : ""
                                                }`}
                                            />
                                        </button>
                                    )}
                                </div>

                                {isExpanded && subItems.length > 0 && (
                                    <div className="border-t border-[var(--border-soft)]/60 px-3 py-2.5 space-y-2 bg-[var(--bg-primary)]/10">
                                        {subItems.map((item) => (
                                            <div key={item.index} className="flex items-center justify-between gap-3">
                                                <div className="flex items-center gap-2 min-w-0">
                                                    <div className="w-1.5 h-1.5 rounded-full bg-[var(--text-muted)]/40 shrink-0" />
                                                    <span className="text-xs font-medium text-[var(--text-main)] truncate">{item.text}</span>
                                                </div>
                                                <select
                                                    value={fixedChecklistAssignments[`${ht.template_task_id}-${item.index}`] || "unassigned"}
                                                    onChange={(e) => {
                                                        const val = e.target.value;
                                                        setFixedChecklistAssignments(prev => ({
                                                            ...prev,
                                                            [`${ht.template_task_id}-${item.index}`]: val,
                                                        }));
                                                    }}
                                                    aria-label={`Asignar trabajador: ${item.text}`}
                                                    className="bg-[var(--bg-card)] border border-[var(--border-color)] text-[var(--text-main)] rounded-full px-2.5 py-1 text-[10px] outline-none cursor-pointer shrink-0 max-w-[140px]"
                                                >
                                                    <option value="unassigned">-- Sin asignar --</option>
                                                    <option value={ALL_WORKERS_VALUE}>
                                                        {dict.tasks?.create_dialog?.assignee_all || "Todos los trabajadores"}
                                                    </option>
                                                    {users.map(u => (
                                                        <option key={u.id} value={u.id.toString()}>
                                                            {u.full_name || u.email}
                                                        </option>
                                                    ))}
                                                </select>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            ) : (
                <div className="text-2xs text-[var(--text-muted)] italic font-semibold py-3 bg-[var(--bg-primary)]/10 text-center rounded-xl border border-dashed border-[var(--border-color)]">
                    {dict.tasks?.create_dialog?.no_fixed_tasks || "This location has no default tasks defined."}
                </div>
            )}

            {isAdminOrManager && showQuickAddFixed && availableTemplates.length > 0 && (
                <div className="bg-[var(--bg-primary)]/20 p-4 border border-[var(--border-soft)] rounded-2xl space-y-3.5 mt-2">
                    <h4 className="text-[10px] font-black uppercase tracking-wider text-[var(--text-main)]">
                        {dict.tasks?.create_dialog?.associate_fixed_task || "Link Default Task to this Location"}
                    </h4>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
                        <div className="space-y-1">
                            <label htmlFor="task-create-template" className="text-[10px] uppercase font-bold text-[var(--text-muted)] block">
                                {dict.locations?.sheet?.select_template_label || "Select the Default Task *"}
                            </label>
                            <select
                                id="task-create-template"
                                value={selectedTmplId}
                                onChange={(e) => setSelectedTmplId(e.target.value)}
                                aria-label={dict.locations?.sheet?.select_template_label || "Select the Default Task *"}
                                className="w-full bg-[var(--bg-card)] border border-[var(--border-color)] text-[var(--text-main)] rounded-xl px-3 py-1.5 text-xs outline-none focus:border-accent h-9 cursor-pointer"
                            >
                                <option value="">{dict.locations?.sheet?.choose_template || "-- Choose from catalog --"}</option>
                                {availableTemplates.map(gt => (
                                    <option key={gt.id} value={gt.id.toString()}>
                                        {gt.name} ({gt.default_price || 0} €)
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className="space-y-1">
                            <label htmlFor="task-create-special-price" className="text-[10px] uppercase font-bold text-[var(--text-muted)] block">
                                {dict.locations?.sheet?.special_price_label || "Special Price (Optional)"}
                            </label>
                            <input
                                id="task-create-special-price"
                                type="number"
                                step="0.01"
                                value={customPriceVal}
                                onChange={(e) => setCustomPriceVal(e.target.value)}
                                placeholder="Base price"
                                className="w-full bg-[var(--bg-card)] border border-[var(--border-color)] text-[var(--text-main)] rounded-xl px-3 py-1.5 text-xs outline-none focus:border-accent h-9"
                            />
                        </div>

                        <div>
                            <button
                                type="button"
                                disabled={isLinking || !selectedTmplId}
                                onClick={async () => {
                                    if (!selectedTmplId) return;
                                    try {
                                        setIsLinking(true);
                                        await handleLinkHouseTemplate(
                                            parseInt(selectedTmplId, 10),
                                            customPriceVal ? parseFloat(customPriceVal) : null,
                                        );
                                        setSelectedTmplId("");
                                        setCustomPriceVal("");
                                        setShowQuickAddFixed(false);
                                    } catch (err) {
                                        console.error(err);
                                    } finally {
                                        setIsLinking(false);
                                    }
                                }}
                                className="w-full bg-black text-white hover:bg-neutral-800 disabled:opacity-50 disabled:cursor-not-allowed text-xs font-semibold rounded-xl px-4 py-2 transition-all flex items-center justify-center shrink-0 h-9 cursor-pointer border-none"
                            >
                                {isLinking ? (
                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                ) : (
                                    dict.locations?.sheet?.associate_btn || "Link as Default Task"
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
