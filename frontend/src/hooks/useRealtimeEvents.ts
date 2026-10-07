"use client";

import { useEffect, useEffectEvent, useMemo, useRef } from "react";

import {
    REALTIME_INVALIDATION_EVENT,
    type RealtimeTopic,
    isRealtimeTopic,
    setRealtimeConnectionState,
} from "@/lib/realtime-events";

type InvalidationPayload = { topics?: unknown };
type ConnectionPayload = { realtime?: unknown };

const INITIAL_RECONNECT_DELAY_MS = 1_000;
const MAX_RECONNECT_DELAY_MS = 5_000;

function parseTopics(event: MessageEvent<string>): RealtimeTopic[] {
    try {
        const payload = JSON.parse(event.data) as InvalidationPayload;
        return Array.isArray(payload.topics)
            ? payload.topics.filter(isRealtimeTopic)
            : [];
    } catch {
        return [];
    }
}

function parseConnectionState(event: MessageEvent<string>): boolean {
    try {
        const payload = JSON.parse(event.data) as ConnectionPayload;
        return payload.realtime === true;
    } catch {
        return false;
    }
}

/** One EventSource per dashboard tab; messages never contain tenant data. */
export function useRealtimeEvents(enabled: boolean): void {
    useEffect(() => {
        if (!enabled || typeof EventSource === "undefined") {
            setRealtimeConnectionState(false);
            return;
        }

        let disposed = false;
        let source: EventSource | null = null;
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
                setRealtimeConnectionState(parseConnectionState(event));
            };
            const handleConnection = (event: MessageEvent<string>) => {
                setRealtimeConnectionState(parseConnectionState(event));
            };
            const handleInvalidation = (event: MessageEvent<string>) => {
                const topics = parseTopics(event);
                if (topics.length > 0) {
                    window.dispatchEvent(new CustomEvent<ReadonlyArray<RealtimeTopic>>(
                        REALTIME_INVALIDATION_EVENT,
                        { detail: topics },
                    ));
                }
            };
            const handleError = () => {
                nextSource.close();
                if (source === nextSource) source = null;
                reconnect();
            };

            nextSource.addEventListener("ready", handleReady as EventListener);
            nextSource.addEventListener("connection", handleConnection as EventListener);
            nextSource.addEventListener("invalidate", handleInvalidation as EventListener);
            nextSource.addEventListener("error", handleError);
        };

        openStream();

        return () => {
            disposed = true;
            if (reconnectTimer !== null) window.clearTimeout(reconnectTimer);
            source?.close();
            setRealtimeConnectionState(false);
        };
    }, [enabled]);
}

/** Reload only when a server-confirmed mutation invalidates this view. */
export function useRealtimeInvalidation(
    topics: readonly RealtimeTopic[],
    reload: () => void,
): void {
    const runReload = useEffectEvent(reload);
    const debounceId = useRef<number | null>(null);
    const topicKey = topics.join(",");
    const requestedTopics = useMemo(
        () => new Set(topicKey ? topicKey.split(",") as RealtimeTopic[] : []),
        [topicKey],
    );

    useEffect(() => {
        const handleInvalidation = (event: Event) => {
            const detail = (event as CustomEvent<ReadonlyArray<RealtimeTopic>>).detail;
            if (!Array.isArray(detail) || !detail.some((topic) => requestedTopics.has(topic))) return;
            if (debounceId.current !== null) return;
            debounceId.current = window.setTimeout(() => {
                debounceId.current = null;
                runReload();
            }, 80);
        };
        window.addEventListener(REALTIME_INVALIDATION_EVENT, handleInvalidation);
        return () => {
            window.removeEventListener(REALTIME_INVALIDATION_EVENT, handleInvalidation);
            if (debounceId.current !== null) {
                window.clearTimeout(debounceId.current);
                debounceId.current = null;
            }
        };
    }, [requestedTopics]);
}
