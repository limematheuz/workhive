export const REALTIME_CONNECTION_STATE_EVENT = "workhive:realtime-connection-state";
export const REALTIME_INVALIDATION_EVENT = "workhive:realtime-invalidation";

export const REALTIME_TOPICS = [
    "calendar",
    "clients",
    "collaborations",
    "dashboard",
    "live-work",
    "locations",
    "notifications",
    "privacy",
    "reservations",
    "sidebar",
    "tasks",
] as const;

export type RealtimeTopic = (typeof REALTIME_TOPICS)[number];

let isRealtimeConnected = false;

export function getRealtimeConnectionState(): boolean {
    return isRealtimeConnected;
}

export function setRealtimeConnectionState(connected: boolean): void {
    if (isRealtimeConnected === connected) return;
    isRealtimeConnected = connected;
    if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent<boolean>(REALTIME_CONNECTION_STATE_EVENT, {
            detail: connected,
        }));
    }
}

export function isRealtimeTopic(value: unknown): value is RealtimeTopic {
    return typeof value === "string" && (REALTIME_TOPICS as readonly string[]).includes(value);
}
