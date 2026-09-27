import { Check, Loader2, X } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import type { Dictionary } from "@/lib/dictionary-context";
import { buildLocalDateTimeIso } from "@/lib/format";
import {
    acceptancePricingValuesForTask,
    hasValidTaskAcceptancePricing,
    type TaskAcceptanceInput,
} from "@/domain/tasks/task-acceptance";
import type { Location } from "@/services/location.service";
import type { TaskItem } from "@/services/task.service";
import { getDefaultTaskDate } from "@/domain/tasks/task-create";
import { toTaskPlanningDateInput } from "@/domain/tasks/task-schedule";

import {
    taskDialogFooterClass,
} from "./taskDialogChrome";
import { TaskRequestReviewContent } from "./TaskRequestReviewContent";

interface TaskRequestReviewProps {
    dict: Dictionary;
    task: TaskItem;
    location?: Location;
    isAdminOrManager: boolean;
    isSaving: boolean;
    description: string;
    planningDate: string;
    planningTime: string;
    maxPlanningDate?: string;
    assigneeName: string;
    onPlanningDateChange: (value: string) => void;
    onPlanningTimeChange: (value: string) => void;
    onAccept?: (taskId: number, input: TaskAcceptanceInput) => Promise<void> | void;
    onReject?: (taskId: number) => Promise<void> | void;
    onClose: () => void;
}

function taskPriorityLabel(priority: TaskItem["priority"]): string {
    if (priority === "high") return "Alta";
    if (priority === "low") return "Baja";
    return "Media";
}

export function TaskRequestReview({
    dict,
    task,
    location,
    isAdminOrManager,
    isSaving,
    description,
    planningDate,
    planningTime,
    maxPlanningDate,
    assigneeName,
    onPlanningDateChange,
    onPlanningTimeChange,
    onAccept,
    onReject,
    onClose,
}: TaskRequestReviewProps) {
    const today = getDefaultTaskDate();
    const checkoutDate = toTaskPlanningDateInput(task.checkout_reservation?.check_out_at);
    const minPlanningDate = checkoutDate > today ? checkoutDate : today;
    const [pricing, setPricing] = useState(() => acceptancePricingValuesForTask(task));
    const hasValidPricing = hasValidTaskAcceptancePricing(pricing);

    const acceptRequest = async () => {
        if (!onAccept) return;
        await onAccept(task.id, {
            scheduledStartAt: buildLocalDateTimeIso(planningDate, planningTime) || undefined,
            pricing,
        });
        onClose();
    };

    const rejectRequest = async () => {
        if (!onReject) return;
        await onReject(task.id);
        onClose();
    };

    return (
        <div className="flex min-h-0 flex-1 flex-col font-sans">
            <TaskRequestReviewContent
                dict={dict}
                task={task}
                location={location}
                description={description}
                planningDate={planningDate}
                planningTime={planningTime}
                maxPlanningDate={maxPlanningDate}
                minPlanningDate={minPlanningDate}
                assigneeName={assigneeName}
                priorityLabel={taskPriorityLabel(task.priority)}
                pricing={pricing}
                managerEditable={isAdminOrManager}
                onPlanningDateChange={onPlanningDateChange}
                onPlanningTimeChange={onPlanningTimeChange}
                onPriceChange={(price) => setPricing((current) => ({ ...current, price }))}
                onPricingModeChange={(pricingMode) => setPricing((current) => ({
                    ...current,
                    pricingMode,
                    unit: pricingMode === "hourly" ? "hour" : current.unit,
                }))}
                onQuantityChange={(quantity) => setPricing((current) => ({ ...current, quantity }))}
                onUnitChange={(unit) => setPricing((current) => ({ ...current, unit }))}
            />

            {isAdminOrManager && (
                <div className={`${taskDialogFooterClass} justify-end`}>
                    {!hasValidPricing && <p className="mr-auto text-xs font-semibold text-amber-700 dark:text-amber-300">Indica el precio acordado antes de aceptar.</p>}
                    <Button type="button" variant="dangerSoft" disabled={isSaving || !hasValidPricing} onClick={() => void rejectRequest()} className="flex-1 sm:flex-none">
                        <X className="h-4 w-4" />
                        Rechazar
                    </Button>
                    <Button type="button" disabled={isSaving || !hasValidPricing} onClick={() => void acceptRequest()} className="flex-1 sm:flex-none">
                        {isSaving ? <><Loader2 className="h-4 w-4 animate-spin" />Procesando...</> : <><Check className="h-4 w-4 stroke-[3px]" />Aceptar</>}
                    </Button>
                </div>
            )}
        </div>
    );
}
