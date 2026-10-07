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

type RealtimeStreamHandlers = {
    onReady: (event: MessageEvent<string>) => void;
    onConnection: (event: MessageEvent<string>) => void;
    onInvalidation: (event: MessageEvent<string>) => void;
};

const INITIAL_RECONNECT_DELAY_MS = 1_000;
const MAX_RECONNECT_DELAY_MS = 5_000;

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

/** Own the browser connection and return its complete disposal boundary. */
export function subscribeToRealtimeEvents({
    onReady,
    onConnection,
    onInvalidation,
}: RealtimeStreamHandlers): () => void {
    if (typeof window === "undefined" || typeof EventSource === "undefined") {
        return () => undefined;
    }

    let disposed = false;
    let source: EventSource | null = null;
    let closeActiveSource: (() => void) | null = null;
    let reconnectTimer: number | null = null;
    let reconnectDelay = INITIAL_RECONNECT_DELAY_MS;

    const reconnect = () => {
        setRealtimeConnectionState(false);
        if (disposed || reconnectTimer !== null) return;
        reconnectTimer = window.setTimeout(() => {
            reconnectTimer = null;
            reconnectDelay = Math.min(reconnectDelay * 2, MAX_RECONNECT_DELAY_MS);
            openStream();
        }, reconnectDelay);
    };

    const openStream = () => {
        if (disposed) return;

        const nextSource = new EventSource("/api/v1/realtime/events", { withCredentials: true });
        source = nextSource;
        const handleReady = (event: MessageEvent<string>) => {
            reconnectDelay = INITIAL_RECONNECT_DELAY_MS;
            onReady(event);
        };
        const handleConnection = (event: MessageEvent<string>) => {
            onConnection(event);
        };
        const handleInvalidation = (event: MessageEvent<string>) => {
            onInvalidation(event);
        };
        const handleError = () => {
            closeStream();
            reconnect();
        };
        const closeStream = () => {
            nextSource.removeEventListener("ready", handleReady as EventListener);
            nextSource.removeEventListener("connection", handleConnection as EventListener);
            nextSource.removeEventListener("invalidate", handleInvalidation as EventListener);
            nextSource.removeEventListener("error", handleError);
            nextSource.close();
            if (source === nextSource) source = null;
            if (closeActiveSource === closeStream) closeActiveSource = null;
        };

        nextSource.addEventListener("ready", handleReady as EventListener);
        nextSource.addEventListener("connection", handleConnection as EventListener);
        nextSource.addEventListener("invalidate", handleInvalidation as EventListener);
        nextSource.addEventListener("error", handleError);
        closeActiveSource = closeStream;
    };

    openStream();

    return () => {
        disposed = true;
        if (reconnectTimer !== null) {
            window.clearTimeout(reconnectTimer);
            reconnectTimer = null;
        }
        closeActiveSource?.();
        setRealtimeConnectionState(false);
    };
}
