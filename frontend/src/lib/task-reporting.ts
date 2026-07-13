import type { ReportedIssue } from "@/types/user";

export function appendReportedIssue(
    current: ReportedIssue[],
    issue: ReportedIssue,
) {
    return { reported_issues: [issue, ...current] };
}


export function getPersistentNotificationHref(notification: { href: string }): string {
    return notification.href.startsWith("/")
        && !notification.href.startsWith("//")
        && !notification.href.includes("\\")
        && !/[\u0000-\u001F\u007F]/.test(notification.href)
        ? notification.href
        : "/dashboard";
}


export function countUnreadTaskNotifications(
    notifications: Array<{ entity_type: string | null; read_at: string | null }>,
): number {
    return notifications.filter(
        (notification) => notification.entity_type === "task_item" && notification.read_at === null,
    ).length;
}


export function getPersistentTaskNotificationIds(
    notifications: Array<{ entity_type: string | null; entity_id: number | null }>,
): Set<number> {
    return new Set(
        notifications.flatMap((notification) => (
            notification.entity_type === "task_item"
            && typeof notification.entity_id === "number"
                ? [notification.entity_id]
                : []
        )),
    );
}
