import { apiFetch, extractErrorMessage } from "@/lib/api";

export interface CalendarConnectionStatus {
    enabled: boolean;
    configured: boolean;
    connected: boolean;
    status: string;
    user_id: number;
    google_account_email?: string | null;
    calendar_name?: string | null;
    last_sync_at?: string | null;
    last_error?: string | null;
    pending_jobs: number;
    connected_users: Array<{
        user_id: number;
        google_account_email?: string | null;
        calendar_name?: string | null;
        status: string;
        last_sync_at?: string | null;
    }>;
}

export interface CalendarSyncResult {
    imported: number;
    exported: number;
    deleted: number;
    failed: number;
    last_sync_at: string;
}

export const CalendarService = {
    getStatus: async (): Promise<CalendarConnectionStatus> => {
        const response = await apiFetch("/api/v1/calendar/status", {
            cache: "no-store",
        });
        if (!response.ok) {
            throw new Error(await extractErrorMessage(response, "Error loading calendar status"));
        }
        return response.json();
    },

    connectGoogle: async (): Promise<void> => {
        const response = await apiFetch("/api/v1/calendar/google/oauth/start", {
            method: "POST",
        });
        if (!response.ok) {
            throw new Error(await extractErrorMessage(response, "Could not start Google authorization"));
        }
        const data = await response.json();
        window.location.assign(data.authorization_url);
    },

    sync: async (): Promise<CalendarSyncResult> => {
        const response = await apiFetch("/api/v1/calendar/sync", {
            method: "POST",
        });
        if (!response.ok) {
            throw new Error(await extractErrorMessage(response, "Calendar synchronization failed"));
        }
        return response.json();
    },

    disconnectGoogle: async (): Promise<void> => {
        const response = await apiFetch("/api/v1/calendar/google", {
            method: "DELETE",
        });
        if (!response.ok) {
            throw new Error(await extractErrorMessage(response, "Could not disconnect Google Calendar"));
        }
    },

    syncInBackground: (): void => {
        void CalendarService.sync().catch(() => {
            // The backend outbox keeps the task pending for a later retry.
        });
    },
};
