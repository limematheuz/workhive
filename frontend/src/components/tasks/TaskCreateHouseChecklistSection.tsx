"use client";

import React, { useState } from "react";
import { ListTodo, Loader2 } from "lucide-react";
import type { Dictionary } from "@/lib/dictionary-context";
import type { TemplateTask, HouseTemplate } from "@/hooks/useTasksPage";
import type { User } from "@/types/user";
import { TaskCreateHouseTemplateList } from "./TaskCreateHouseTemplateList";
import type { TaskCreationPricingOverride } from "@/lib/task-pricing";
import {
    taskFormSectionClass,
    taskFormSectionHeaderClass,
    taskFormSectionHintClass,
    taskFormSectionTitleClass,
} from "./taskFormLayout";

type TaskCreateHouseChecklistSectionProps = {
    dict: Dictionary;
    isAdminOrManager: boolean;
    users: User[];
    templates: TemplateTask[];
    houseTemplates: HouseTemplate[];
    visibleHouseTemplates: HouseTemplate[];
    loadingHouseTemplates: boolean;
    selectedHouseTemplateId: number | null;
    useHouseChecklist: boolean;
    setUseHouseChecklist: (use: boolean) => void;
    selectHouseTemplate: (id: number) => void;
    availableTemplates: TemplateTask[];
    handleLinkHouseTemplate: (templateTaskId: number, customPrice: number | null) => Promise<void>;
    fixedChecklistAssignments: Record<string, string>;
    setFixedChecklistAssignments: React.Dispatch<React.SetStateAction<Record<string, string>>>;
    taskPricingOverrides: Record<number, TaskCreationPricingOverride>;
    setTaskPricingOverrides: React.Dispatch<React.SetStateAction<Record<number, TaskCreationPricingOverride>>>;
    defaultAssigneeId: string;
    setDefaultAssigneeId: (value: string) => void;
};

export function TaskCreateHouseChecklistSection({
    dict,
    isAdminOrManager,
    users,
    templates,
    visibleHouseTemplates,
    loadingHouseTemplates,
    selectedHouseTemplateId,
    useHouseChecklist,
    setUseHouseChecklist,
    selectHouseTemplate,
    availableTemplates,
    handleLinkHouseTemplate,
    fixedChecklistAssignments,
    setFixedChecklistAssignments,
    taskPricingOverrides,
    setTaskPricingOverrides,
    defaultAssigneeId,
    setDefaultAssigneeId,
}: TaskCreateHouseChecklistSectionProps) {
    const [selectedTmplId, setSelectedTmplId] = useState("");
    const [customPriceVal, setCustomPriceVal] = useState("");
    const [isLinking, setIsLinking] = useState(false);
    const [showQuickAddFixed, setShowQuickAddFixed] = useState(false);
    return (
        <section className={taskFormSectionClass}>
            <div className={taskFormSectionHeaderClass}>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="space-y-1">
                        <h3 className={`${taskFormSectionTitleClass} flex items-center gap-1.5`}>
                    <ListTodo className="w-4 h-4 text-accent" />
                            {dict.tasks?.create_dialog?.services_section
                                || "Services and checklist"}
                        </h3>
                        <p className={taskFormSectionHintClass}>
                            {dict.tasks?.create_dialog?.services_section_hint
                                || "Select fixed work, review steps and assign owners."}
                        </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                    {isAdminOrManager && availableTemplates.length > 0 && (
                        <button
                            type="button"
                            onClick={() => setShowQuickAddFixed(!showQuickAddFixed)}
                            className="text-2xs font-bold uppercase text-accent hover:underline cursor-pointer"
                        >
                            {showQuickAddFixed
                                ? (dict.tasks?.create_dialog?.cancel_link || "Cancel")
                                : `+ ${dict.tasks?.create_dialog?.link_default_task || "Link Default Task"}`}
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
            </div>

            {loadingHouseTemplates ? (
                <div className="flex items-center gap-2 py-4 justify-center">
                    <Loader2 className="w-4 h-4 animate-spin text-accent" />
                    <span className="text-2xs text-[var(--text-muted)] font-semibold">{dict.tasks?.create_dialog?.searching_fixed_tasks || "Searching default tasks..."}</span>
                </div>
            ) : visibleHouseTemplates.length > 0 ? (
                <TaskCreateHouseTemplateList
                    dict={dict}
                    users={users}
                    templates={templates}
                    visibleHouseTemplates={visibleHouseTemplates}
                    selectedHouseTemplateId={selectedHouseTemplateId}
                    useHouseChecklist={useHouseChecklist}
                    selectHouseTemplate={selectHouseTemplate}
                    fixedChecklistAssignments={fixedChecklistAssignments}
                    setFixedChecklistAssignments={setFixedChecklistAssignments}
                    taskPricingOverrides={taskPricingOverrides}
                    setTaskPricingOverrides={setTaskPricingOverrides}
                    defaultAssigneeId={defaultAssigneeId}
                    setDefaultAssigneeId={setDefaultAssigneeId}
                />
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
                                data-price-input
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
                                className="w-full bg-black text-white hover:bg-neutral-800 disabled:opacity-50 disabled:cursor-not-allowed text-xs font-semibold rounded-xl px-4 py-2 ui-motion flex items-center justify-center shrink-0 h-9 cursor-pointer border-none"
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
        </section>
    );
}
