export type TaskNotificationPriority = "update" | "alert";

/**
 * New work is an update; a rejected request or overdue operational work is an
 * alert. Alerts remain a first-class tab instead of being buried as secondary
 * information.
 */
export function getTaskNotificationPriority(
    status: string | null | undefined,
    isOverdue: boolean,
): TaskNotificationPriority {
    return status === "rejected" || isOverdue ? "alert" : "update";
}
