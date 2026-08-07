import { getUserTaskStatus } from "./format.ts";
import {
    isOperationalStatus,
    normalizeTaskStatus,
} from "../domain/tasks/task-status.ts";
import { isTaskChecklistComplete, taskHasChecklist } from "./task-checklist-completion.ts";
import type { TaskStatus } from "../types/task.ts";
import type { TaskItem } from "../types/user.ts";

/**
 * The sidebar and the operational overview must describe the same workload.
 * Notifications are deliberately excluded: they are acknowledgements, not
 * open work, and remain represented by the bell.
 */
export function getOperationalTaskStatus(
    task: TaskItem,
    userId: number,
    canManageCompanyTasks: boolean,
): TaskStatus {
    const effectiveStatus = canManageCompanyTasks
        ? normalizeTaskStatus(task.status)
        : getUserTaskStatus(task, userId);

    if (effectiveStatus === "completed") return "completed";

    // The server promotes the task to completed as soon as every requirement
    // is answered. Keep the dashboard correct during the refresh window too.
    if (
        isOperationalStatus(task.status)
        && taskHasChecklist(task)
        && isTaskChecklistComplete(task)
    ) {
        return "completed";
    }

    return effectiveStatus;
}

export function isTaskPendingInOperationalOverview(
    task: TaskItem,
    userId: number,
    canManageCompanyTasks: boolean,
): boolean {
    if (!isOperationalStatus(task.status)) return false;

    return getOperationalTaskStatus(task, userId, canManageCompanyTasks) !== "completed";
}

export function countOperationalPendingTasks(
    tasks: TaskItem[],
    userId: number,
    canManageCompanyTasks: boolean,
): number {
    return tasks.filter((task) => (
        isTaskPendingInOperationalOverview(task, userId, canManageCompanyTasks)
    )).length;
}
