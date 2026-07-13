import { apiFetch, extractErrorMessage } from "@/lib/api";


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

export const NotificationService = {
    listUnread: async (): Promise<PersistentNotification[]> => {
        const response = await apiFetch("/api/v1/notifications/?unread_only=true&limit=200", {
            cache: "no-store",
        });
        if (!response.ok) {
            throw new Error(await extractErrorMessage(response, "Could not load notifications"));
        }
        return await response.json();
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
};
