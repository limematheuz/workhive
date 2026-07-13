import { apiFetch, extractErrorMessage } from "@/lib/api";
import { buildPrivacyResolutionPayload } from "@/lib/privacy-request";

export type PrivacyRequestType =
    | "access"
    | "rectification"
    | "erasure"
    | "restriction"
    | "portability"
    | "objection";

export interface PrivacyRequest {
    id: number;
    request_type: PrivacyRequestType;
    status: string;
    reason: string | null;
    company_id?: number | null;
    requested_by_user_id?: number | null;
    requested_at: string;
    resolved_at: string | null;
    resolution_notes: string | null;
}

export const PrivacyService = {
    exportMyData: async (): Promise<void> => {
        const response = await apiFetch("/api/v1/privacy/export", {
            cache: "no-store",
        });
        if (!response.ok) {
            throw new Error(
                await extractErrorMessage(response, "Could not export your data"),
            );
        }
        const blob = await response.blob();
        const disposition = response.headers.get("Content-Disposition") || "";
        const filename = disposition.match(/filename="([^"]+)"/)?.[1]
            || "workhive-data-export.json";
        const objectUrl = URL.createObjectURL(blob);
        const anchor = document.createElement("a");
        anchor.href = objectUrl;
        anchor.download = filename;
        anchor.click();
        URL.revokeObjectURL(objectUrl);
    },

    listMyRequests: async (): Promise<PrivacyRequest[]> => {
        const response = await apiFetch("/api/v1/privacy/requests/me", {
            cache: "no-store",
        });
        if (!response.ok) {
            throw new Error(
                await extractErrorMessage(response, "Could not load privacy requests"),
            );
        }
        return await response.json();
    },

    listCompanyRequests: async (): Promise<PrivacyRequest[]> => {
        const response = await apiFetch("/api/v1/privacy/requests", {
            cache: "no-store",
        });
        if (!response.ok) {
            throw new Error(
                await extractErrorMessage(response, "Could not load company requests"),
            );
        }
        return await response.json();
    },

    createRequest: async (
        requestType: PrivacyRequestType,
        reason?: string,
    ): Promise<PrivacyRequest> => {
        const response = await apiFetch("/api/v1/privacy/requests", {
            method: "POST",
            body: JSON.stringify({
                request_type: requestType,
                reason: reason || null,
            }),
        });
        if (!response.ok) {
            throw new Error(
                await extractErrorMessage(response, "Could not create the request"),
            );
        }
        return await response.json();
    },

    resolveRequest: async (
        requestId: number,
        decision: "complete" | "reject",
        resolutionNotes: string,
    ): Promise<PrivacyRequest> => {
        const response = await apiFetch(
            `/api/v1/privacy/requests/${requestId}/resolve`,
            {
                method: "POST",
                body: JSON.stringify(
                    buildPrivacyResolutionPayload(decision, resolutionNotes),
                ),
            },
        );
        if (!response.ok) {
            throw new Error(
                await extractErrorMessage(response, "Could not resolve the request"),
            );
        }
        return await response.json();
    },
};
