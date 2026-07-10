import { normalizeTaskStatus } from "@/domain/tasks/task-status";
import type { TaskStatus, TaskStatusValue } from "@/types/task";

export const CALENDAR_STATUS_COLORS: Record<TaskStatus, string> = {
    requested: "#dc2626",
    pending: "#d97706",
    accepted: "#2563eb",
    rejected: "#dc2626",
    progress: "#2563eb",
    review: "#7c3aed",
    completed: "#059669",
};

export function getCalendarStatusColor(status: TaskStatusValue): string {
    return CALENDAR_STATUS_COLORS[normalizeTaskStatus(status)];
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
