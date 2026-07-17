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
    owner_user_id: number;
    owner_name?: string | null;
    owner_email?: string | null;
    is_owner: boolean;
    can_connect: boolean;
    can_disconnect: boolean;
    can_sync: boolean;
    can_request_ownership: boolean;
    ownership_request_status?: string | null;
    pending_ownership_requests: CalendarOwnershipRequest[];
}

export interface CalendarOwnershipRequest {
    id: number;
    requester_user_id: number;
    requester_name?: string | null;
    requester_email: string;
    status: string;
    created_at: string;
}

export interface PlatformCalendarStatus {
    environment_enabled: boolean;
    google_cloud_configured: boolean;
    company_connections_enabled: boolean;
    available: boolean;
    redirect_uri: string;
    timezone: string;
    background_sync_enabled: boolean;
    connected_companies: number;
    pending_ownership_requests: number;
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

    requestOwnership: async (): Promise<CalendarOwnershipRequest> => {
        const response = await apiFetch("/api/v1/calendar/ownership-requests", {
            method: "POST",
        });
        if (!response.ok) {
            throw new Error(await extractErrorMessage(response, "Could not request calendar control"));
        }
        return response.json();
    },

    reviewOwnership: async (
        requestId: number,
        decision: "approve" | "reject",
    ): Promise<CalendarOwnershipRequest> => {
        const response = await apiFetch(
            `/api/v1/calendar/ownership-requests/${requestId}/${decision}`,
            { method: "POST" },
        );
        if (!response.ok) {
            throw new Error(await extractErrorMessage(response, "Could not review calendar request"));
        }
        return response.json();
    },

    getPlatformStatus: async (): Promise<PlatformCalendarStatus> => {
        const response = await apiFetch("/api/v1/calendar/platform/status", {
            cache: "no-store",
        });
        if (!response.ok) {
            throw new Error(await extractErrorMessage(response, "Could not load Google Calendar configuration"));
        }
        return response.json();
    },

    updatePlatformStatus: async (
        companyConnectionsEnabled: boolean,
    ): Promise<PlatformCalendarStatus> => {
        const response = await apiFetch("/api/v1/calendar/platform/status", {
            method: "PATCH",
            body: JSON.stringify({
                company_connections_enabled: companyConnectionsEnabled,
            }),
        });
        if (!response.ok) {
            throw new Error(await extractErrorMessage(response, "Could not update Google Calendar availability"));
        }
        return response.json();
    },

    syncInBackground: (): void => {
        void CalendarService.sync().catch(() => {
            // The backend outbox keeps the task pending for a later retry.
        });
    },
};
