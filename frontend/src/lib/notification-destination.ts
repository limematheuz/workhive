import { getPersistentNotificationHref } from "./task-reporting.ts";

export function getNotificationDestination(notification: {
    href: string;
    entity_type?: string | null;
    entity_id?: number | null;
}, workerMode: boolean): string {
    if (workerMode && notification.entity_type === "task_item"
        && typeof notification.entity_id === "number"
        && Number.isSafeInteger(notification.entity_id) && notification.entity_id > 0) {
        return `/worker/jobs?taskId=${notification.entity_id}`;
    }
    return getPersistentNotificationHref(notification);
}
