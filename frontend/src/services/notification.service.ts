import { apiFetch, assertApiResponseOk, extractErrorMessage } from "@/lib/api";
import { collectPaginated } from "@/lib/pagination";


export interface PersistentNotification {
    id: number;
    event_type: string;
    title: string;
    message: string;
    entity_type: string | null;
    entity_id: number | null;
    href: string;
    metadata_json: Record<string, unknown>;
    read_at: string | null;
    created_at: string;
}

export interface TaskNotificationAcknowledgement {
    task_item_id: number;
    read_at: string;
}

export const NotificationService = {
    listUnread: async (readContext?: string): Promise<PersistentNotification[]> => {
        const items = await collectPaginated<PersistentNotification>(async (skip, limit) => {
            const response = await apiFetch(`/api/v1/notifications/?unread_only=true&limit=${limit}&skip=${skip}`, {
                cache: "no-store",
                // Separates client-side in-flight reads; the backend still authorizes the session.
                headers: readContext ? { "X-Notification-Context": readContext } : undefined,
            });
            await assertApiResponseOk(response, "Could not load notifications");
            return response.json();
        }, 200);
        return [...new Map(items.map(item => [item.id, item])).values()];
    },

    listTaskAcknowledgements: async (readContext?: string): Promise<TaskNotificationAcknowledgement[]> => {
        const response = await apiFetch("/api/v1/notifications/task-items/acknowledged", {
            cache: "no-store",
            headers: readContext ? { "X-Notification-Context": readContext } : undefined,
        });
        await assertApiResponseOk(response, "Could not load notification read state");
        return response.json();
    },

    markRead: async (id: number): Promise<void> => {
        const response = await apiFetch(`/api/v1/notifications/${id}/read`, { method: "PATCH" });
        if (!response.ok) {
            throw new Error(await extractErrorMessage(response, "Could not mark notification as read"));
        }
    },

    markAllRead: async (): Promise<void> => {
        const response = await apiFetch("/api/v1/notifications/read-all", { method: "PATCH" });
        if (!response.ok) {
            throw new Error(await extractErrorMessage(response, "Could not clear notifications"));
        }
    },

    markTaskItemRead: async (taskItemId: number): Promise<void> => {
        const response = await apiFetch(`/api/v1/notifications/task-items/${taskItemId}/read`, {
            method: "PATCH",
        });
        if (!response.ok) {
            throw new Error(await extractErrorMessage(response, "Could not acknowledge task notifications"));
        }
    },
};
