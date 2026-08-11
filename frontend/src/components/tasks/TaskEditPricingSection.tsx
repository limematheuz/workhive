"use client";

import type { Dictionary } from "@/lib/dictionary-context";
import { formatHoursShort } from "@/lib/format-hours";
import type { TaskPricingMode } from "@/domain/tasks/task-edit";
import { TASK_EDIT_UNIT_OPTIONS } from "./taskEditFormOptions";
import {
    taskFormControlClass,
    taskFormLabelClass,
    taskFormReadOnlyClass,
    taskFormSectionClass,
    taskFormSectionHeaderClass,
    taskFormSectionHintClass,
    taskFormSectionTitleClass,
} from "./taskFormLayout";

type TaskPricingAgreementSectionProps = {
    dict: Dictionary;
    managerEditable: boolean;
    price: string;
    pricingLocked: boolean;
    pricingMode: TaskPricingMode;
    quantity: string;
    snapshotSeconds: number | null | undefined;
    unit: string;
    onPriceChange: (value: string) => void;
    onPricingModeChange: (value: TaskPricingMode) => void;
    onQuantityChange: (value: string) => void;
    onUnitChange: (value: string) => void;
};

export function TaskPricingAgreementSection({
    dict,
    managerEditable,
    price,
    pricingLocked,
    pricingMode,
    quantity,
    snapshotSeconds,
    unit,
    onPriceChange,
    onPricingModeChange,
    onQuantityChange,
    onUnitChange,
}: TaskPricingAgreementSectionProps) {
    const isHourly = pricingMode === "hourly";
    const inputDisabled = !managerEditable || pricingLocked;

    return (
        <section className={taskFormSectionClass}>
            <div className={taskFormSectionHeaderClass}>
                <h3 className={taskFormSectionTitleClass}>
                    {dict.tasks?.dialog?.pricing_mode_label || "Billing agreement"}
                </h3>
                <p className={taskFormSectionHintClass}>
                    {pricingLocked
                        ? "Las condiciones pactadas se bloquearon al iniciar el trabajo."
                        : "Define el precio acordado antes de iniciar. El tiempo se registra siempre."}
                </p>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                    <label htmlFor="task-edit-pricing-mode" className={taskFormLabelClass}>
                        {dict.tasks?.dialog?.pricing_mode_label || "Billing mode"}
                    </label>
                    <select
                        id="task-edit-pricing-mode"
                        value={pricingMode}
                        onChange={(event) => onPricingModeChange(event.target.value as TaskPricingMode)}
                        disabled={inputDisabled}
                        className={taskFormControlClass}
                    >
                        <option value="fixed">
                            {dict.tasks?.dialog?.pricing_mode_fixed || "Fixed price"}
                        </option>
                        <option value="hourly">
                            {dict.tasks?.dialog?.pricing_mode_hourly || "Hourly (person-hours)"}
                        </option>
                    </select>
                </div>
                {typeof snapshotSeconds === "number" && (
                    <div className="space-y-1.5">
                        <span className={taskFormLabelClass}>
                            {dict.tasks?.dialog?.worked_hours_snapshot_label || "Recorded person-hours"}
                        </span>
                        <div className={taskFormReadOnlyClass}>
                            {formatHoursShort(snapshotSeconds)}
                        </div>
                    </div>
                )}
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="space-y-1.5">
                    <label htmlFor="task-edit-price" className={taskFormLabelClass}>
                        {isHourly
                            ? (dict.tasks?.dialog?.hourly_rate_label || "Hourly rate (€/h)")
                            : (dict.tasks?.dialog?.price_label || "Price (€)")}
                    </label>
                    <input
                        id="task-edit-price"
                        type="number"
                        min={isHourly ? "0.01" : "0"}
                        step="0.01"
                        data-price-input
                        value={price}
                        onChange={(event) => onPriceChange(event.target.value)}
                        disabled={inputDisabled}
                        className={`${taskFormControlClass} font-mono`}
                    />
                </div>
                <div className="space-y-1.5">
                    <label htmlFor="task-edit-quantity" className={taskFormLabelClass}>
                        {isHourly
                            ? (dict.tasks?.dialog?.hours_from_sessions_label || "Hours (from sessions)")
                            : (dict.tasks?.dialog?.quantity_label || "Quantity")}
                    </label>
                    <input
                        id="task-edit-quantity"
                        type="number"
                        step="0.1"
                        value={isHourly
                            ? (typeof snapshotSeconds === "number"
                                ? (snapshotSeconds / 3600).toFixed(4)
                                : "")
                            : quantity}
                        onChange={(event) => onQuantityChange(event.target.value)}
                        disabled={inputDisabled || isHourly}
                        className={`${taskFormControlClass} font-mono`}
                    />
                </div>
                <div className="space-y-1.5">
                    <label htmlFor="task-edit-unit" className={taskFormLabelClass}>
                        {dict.tasks?.dialog?.unit_label || "Unit"}
                    </label>
                    <select
                        id="task-edit-unit"
                        value={isHourly ? "hour" : unit}
                        onChange={(event) => onUnitChange(event.target.value)}
                        disabled={inputDisabled || isHourly}
                        required
                        className={taskFormControlClass}
                    >
                        {TASK_EDIT_UNIT_OPTIONS.map((option) => (
                            <option key={option} value={option}>{option}</option>
                        ))}
                    </select>
                </div>
            </div>
        </section>
    );
}
