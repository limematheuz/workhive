"use client";

import { useEffect, useEffectEvent, useMemo, useRef } from "react";

import {
    REALTIME_INVALIDATION_EVENT,
    REALTIME_TOPICS,
    getRealtimeConnectionState,
    type RealtimeTopic,
    isRealtimeTopic,
    setRealtimeConnectionState,
    subscribeToRealtimeEvents,
} from "@/lib/realtime-events";

type InvalidationPayload = { topics?: unknown };
type ConnectionPayload = { realtime?: unknown };

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

        let receivedConnectionState = false;
        const updateConnectionState = (event: MessageEvent<string>) => {
            const wasConnected = getRealtimeConnectionState();
            const connected = parseConnectionState(event);
            setRealtimeConnectionState(connected);
            // Events sent during an outage cannot be replayed. Revalidate the
            // active views once on recovery, without duplicating initial load.
            if (receivedConnectionState && connected && !wasConnected) {
                window.dispatchEvent(new CustomEvent<ReadonlyArray<RealtimeTopic>>(
                    REALTIME_INVALIDATION_EVENT,
                    { detail: REALTIME_TOPICS },
                ));
            }
            receivedConnectionState = true;
        };

        return subscribeToRealtimeEvents({
            onReady: updateConnectionState,
            onConnection: updateConnectionState,
            onInvalidation: (event) => {
                const topics = parseTopics(event);
                if (topics.length > 0) {
                    window.dispatchEvent(new CustomEvent<ReadonlyArray<RealtimeTopic>>(
                        REALTIME_INVALIDATION_EVENT,
                        { detail: topics },
                    ));
                }
            },
        });
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
