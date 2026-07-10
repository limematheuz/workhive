import { apiFetch } from "@/lib/api";

export interface PageViewPayload {
    visitor_id: string;
    path: string;
    referrer?: string | null;
    title?: string | null;
    screen?: string | null;
    timezone?: string | null;
    language?: string | null;
}

export const TrafficService = {
    recordPageView: async (payload: PageViewPayload): Promise<void> => {
        await apiFetch("/api/v1/traffic/page-view", {
            method: "POST",
            keepalive: true,
            body: JSON.stringify(payload),
        }).catch(() => undefined);
    },
};
