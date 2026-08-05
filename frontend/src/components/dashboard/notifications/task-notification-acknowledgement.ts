"use client";

import type { TaskItem } from "@/types/user";
import { NotificationService } from "@/services/notification.service";

import {
    dismissTaskNotification,
    NOTIFICATIONS_UPDATED_EVENT,
} from "./notification-utils";

/**
 * A task stops being new the moment its details are opened. The local update
 * keeps that interaction instant, while the server request makes it durable
 * across sessions and devices without delaying navigation.
 */
export function acknowledgeTaskOpened(userId: number, task: TaskItem): void {
    dismissTaskNotification(userId, task);
    void NotificationService.markTaskItemRead(task.id).then(
        () => {
            if (typeof window !== "undefined") {
                window.dispatchEvent(new CustomEvent(NOTIFICATIONS_UPDATED_EVENT, {
                    detail: { userId, taskItemId: task.id, serverConfirmed: true },
                }));
            }
        },
    );
}
