export type TaskNotificationPriority = "update" | "alert";
export type PersistentNotificationPriority = "update" | "alert";

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

export function getPersistentNotificationPriority(
    entityType: string | null | undefined,
    eventType: string | null | undefined,
): PersistentNotificationPriority {
    return entityType === "invoice" && eventType?.startsWith("invoice.payment_")
        ? "alert"
        : "update";
}
