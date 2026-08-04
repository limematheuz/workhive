"use client";

import type { TaskItem } from "@/types/user";
import type { CompanyCollaboration } from "@/types/collaboration";
import type { Reservation } from "@/types/reservation";
import type { PrivacyRequest } from "@/services/privacy.service";

export type NotificationTab = "primary" | "secondary";

export const NOTIFICATIONS_UPDATED_EVENT = "workhive:notifications-updated";

export const getNotificationReadKey = (userId: number) => `workhive_read_notifications_${userId}`;
export const getNotificationDismissedKey = (userId: number) => `workhive_dismissed_notifications_v2_${userId}`;

export const getDismissedNotificationKeys = (userId: number): string[] => {
    if (typeof window === "undefined") return [];
    try {
        const raw = localStorage.getItem(getNotificationDismissedKey(userId));
        const parsed = raw ? JSON.parse(raw) : [];
        const dismissedKeys = Array.isArray(parsed)
            ? parsed.filter((key): key is string => typeof key === "string")
            : [];

        const legacyRaw = localStorage.getItem(getNotificationReadKey(userId));
        const legacyIds = legacyRaw ? JSON.parse(legacyRaw) : [];
        const migratedKeys = Array.isArray(legacyIds)
            ? legacyIds.flatMap((id) => typeof id === "number"
                ? [`task:${id}:pending`, `task:${id}:requested`, `task:${id}:rejected`]
                : [])
            : [];

        return Array.from(new Set([...dismissedKeys, ...migratedKeys]));
    } catch {
        return [];
    }
};

export const persistDismissedNotificationKeys = (userId: number, keys: string[]) => {
    if (typeof window === "undefined") return;
    localStorage.setItem(getNotificationDismissedKey(userId), JSON.stringify(Array.from(new Set(keys))));
    window.dispatchEvent(new CustomEvent(NOTIFICATIONS_UPDATED_EVENT, { detail: { userId } }));
};

export const addDismissedNotificationKey = (keys: string[], key: string) => (
    Array.from(new Set([...keys, key]))
);

export const getTaskNotificationKey = (task: TaskItem) => `task:${task.id}:${task.status}`;

/**
 * Opening a task is an acknowledgement of its client-side task alert. Keeping
 * it here makes every task entry point behave identically and emits the same
 * event that the notification panel already listens to.
 */
export const dismissTaskNotification = (userId: number, task: TaskItem) => {
    persistDismissedNotificationKeys(
        userId,
        addDismissedNotificationKey(
            getDismissedNotificationKeys(userId),
            getTaskNotificationKey(task),
        ),
    );
};
export const getCollaborationNotificationKey = (collaboration: CompanyCollaboration) => `collaboration:${collaboration.id}:${collaboration.status}`;
export const getReservationNotificationKey = (reservation: Reservation) => (
    reservation.status === "cancelled"
        ? `reservation:${reservation.id}:cancelled`
        : `reservation:${reservation.id}:created`
);
export const getUpcomingArrivalNotificationKey = (reservation: Reservation) => (
    `reservation:${reservation.id}:arrival:${reservation.check_in_at}`
);
export const getPrivacyRequestNotificationKey = (request: PrivacyRequest) => (
    `privacy:${request.id}:${request.status}`
);

export const isWithinLastDays = (value: string, days: number, referenceTime: number) => (
    new Date(value).getTime() >= referenceTime - days * 24 * 60 * 60 * 1000
);
