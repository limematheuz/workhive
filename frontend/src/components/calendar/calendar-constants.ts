import { normalizeTaskStatus } from "@/domain/tasks/task-status";
import type { TaskStatus, TaskStatusValue } from "@/types/task";
import {
    CALENDAR_STATUS_COLORS,
    CALENDAR_STATUS_SOFT_COLORS,
    isCalendarEventPast,
} from "@/lib/calendar-event-styling";

export {
    CALENDAR_STATUS_COLORS,
    CALENDAR_STATUS_SOFT_COLORS,
    isCalendarEventPast,
};

export function getCalendarStatusColor(status: TaskStatusValue): string {
    return CALENDAR_STATUS_COLORS[normalizeTaskStatus(status)];
}

export function getCalendarStatusSoftColors(status: TaskStatusValue) {
    return CALENDAR_STATUS_SOFT_COLORS[normalizeTaskStatus(status)];
}

export function getCalendarStatusLabel(status: TaskStatusValue): string {
    const normalized = normalizeTaskStatus(status);
    const labels: Record<TaskStatus, string> = {
        requested: "Solicitud pendiente",
        pending: "Pendiente",
        accepted: "Aceptado",
        rejected: "Rechazado",
        progress: "En progreso",
        review: "En revisión",
        completed: "Completado",
    };
    return labels[normalized];
}
