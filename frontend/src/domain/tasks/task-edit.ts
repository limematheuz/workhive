import {
    buildLocalDateTimeIso,
} from "@/lib/format";
import {
    editableTaskPricingUpdate,
    pricingValuesForTaskEdit,
} from "@/lib/task-pricing";
import type { TaskPricingMode } from "@/lib/task-pricing";
import { isExternalTaskForCompany } from "@/lib/task-display";
import { buildExternalTaskOperationalUpdate } from "@/lib/external-task-update";
import type { TaskItemUpdate } from "@/services/task.service";
import type { TaskItem } from "@/types/user";
import type { TaskPriority, TaskStatus } from "@/types/task";
import { completionDateForStatus, normalizeTaskStatus } from "./task-status";
import {
    toTaskPlanningDateInput,
    toTaskPlanningTimeInput,
} from "./task-schedule";

export type { TaskPricingMode } from "@/lib/task-pricing";

export interface TaskEditValues {
    title: string;
    notes: string;
    description: string;
    price: string;
    quantity: string;
    unit: string;
    pricingMode: TaskPricingMode;
    locationId: string;
    userId: string;
    status: TaskStatus;
    priority: TaskPriority;
    planningDate: string;
    planningTime: string;
}

export function taskToEditValues(task: TaskItem): TaskEditValues {
    const planningValue = task.scheduled_start_at
        || task.checkout_reservation?.check_out_at
        || task.created_at;
    const pricing = pricingValuesForTaskEdit(task);
    return {
        title: task.title,
        notes: task.notes || "",
        description: task.description || "",
        ...pricing,
        locationId: String(task.location_id),
        userId: task.user_id?.toString() || "",
        status: task.status === "requested"
            ? "pending"
            : normalizeTaskStatus(task.status),
        priority: task.priority || "medium",
        planningDate: toTaskPlanningDateInput(planningValue),
        planningTime: toTaskPlanningTimeInput(planningValue),
    };
}

export function buildScheduledStartAt(values: TaskEditValues): string | null {
    return buildLocalDateTimeIso(values.planningDate, values.planningTime);
}

export function buildTaskUpdatePayload(
    task: TaskItem,
    companyId: number | null | undefined,
    values: TaskEditValues,
): TaskItemUpdate {
    const scheduledStartAt = buildScheduledStartAt(values);
    const externalTask = isExternalTaskForCompany(task, companyId);
    const operationalFields: TaskItemUpdate = {
        description: values.description || null,
        scheduled_start_at: scheduledStartAt,
    };
    // Commercial terms are agreed before work starts. Once the backend has
    // frozen them, do not send them again from the edit form.
    const pricingFields: TaskItemUpdate = editableTaskPricingUpdate(task, values);

    if (externalTask) {
        return {
            ...buildExternalTaskOperationalUpdate({
                description: values.description,
                scheduledStartAt,
                status: values.status,
                dateDone: completionDateForStatus(values.status),
            }),
            ...pricingFields,
        };
    }

    return {
        ...operationalFields,
        ...pricingFields,
        title: values.title,
        notes: values.notes || null,
        location_id: Number.parseInt(values.locationId, 10),
        user_id: values.userId ? Number.parseInt(values.userId, 10) : null,
        status: values.status,
        priority: values.priority,
        date_done: completionDateForStatus(values.status),
    };
}
