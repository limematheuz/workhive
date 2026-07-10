import {
    buildLocalDateTimeIso,
    toLocalDateInput,
    toLocalTimeInput,
} from "@/lib/format";
import { isExternalTaskForCompany } from "@/lib/task-display";
import { buildExternalTaskOperationalUpdate } from "@/lib/external-task-update";
import type { TaskItemUpdate } from "@/services/task.service";
import type { TaskItem } from "@/types/user";
import type { TaskPriority, TaskStatus } from "@/types/task";
import { completionDateForStatus, normalizeTaskStatus } from "./task-status";

export interface TaskEditValues {
    title: string;
    notes: string;
    description: string;
    price: string;
    quantity: string;
    unit: string;
    locationId: string;
    userId: string;
    status: TaskStatus;
    priority: TaskPriority;
    planningDate: string;
    planningTime: string;
}

function optionalNumber(value: string): number | null {
    if (!value.trim()) return null;
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : null;
}

export function taskToEditValues(task: TaskItem): TaskEditValues {
    const planningValue = task.scheduled_start_at
        || task.checkout_reservation?.check_out_at
        || task.created_at;
    return {
        title: task.title,
        notes: task.notes || "",
        description: task.description || "",
        price: task.price?.toString() || "",
        quantity: task.quantity?.toString() || "",
        unit: task.unit || "unidad",
        locationId: String(task.location_id),
        userId: task.user_id?.toString() || "",
        status: task.status === "requested"
            ? "pending"
            : normalizeTaskStatus(task.status),
        priority: task.priority || "medium",
        planningDate: toLocalDateInput(planningValue),
        planningTime: toLocalTimeInput(planningValue),
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

    if (externalTask) {
        return buildExternalTaskOperationalUpdate({
            description: values.description,
            scheduledStartAt,
            status: values.status,
            dateDone: completionDateForStatus(values.status),
        });
    }

    return {
        ...operationalFields,
        title: values.title,
        notes: values.notes || null,
        price: optionalNumber(values.price),
        quantity: optionalNumber(values.quantity),
        unit: values.unit,
        location_id: Number.parseInt(values.locationId, 10),
        user_id: values.userId ? Number.parseInt(values.userId, 10) : null,
        status: values.status,
        priority: values.priority,
        date_done: completionDateForStatus(values.status),
    };
}
