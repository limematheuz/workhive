import { getUserTaskStatus } from "./format.ts";
import {
    isOperationalStatus,
    normalizeTaskStatus,
} from "../domain/tasks/task-status.ts";
import type { TaskItem } from "../types/user.ts";

/**
 * The sidebar and the operational overview must describe the same workload.
 * Notifications are deliberately excluded: they are acknowledgements, not
 * open work, and remain represented by the bell.
 */
export function isTaskPendingInOperationalOverview(
    task: TaskItem,
    userId: number,
    canManageCompanyTasks: boolean,
): boolean {
    if (!isOperationalStatus(task.status)) return false;

    const effectiveStatus = canManageCompanyTasks
        ? normalizeTaskStatus(task.status)
        : getUserTaskStatus(task, userId);

    return effectiveStatus !== "completed";
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
