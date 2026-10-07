import { useEffect, useEffectEvent, useRef, useState } from "react";
import { hasActiveMutations } from "@/lib/api";
import {
    REALTIME_CONNECTION_STATE_EVENT,
    getRealtimeConnectionState,
} from "@/lib/realtime-events";

export function useBackgroundPolling(
    callback: () => Promise<void> | void,
    fallbackDelay: number,
    realtimeSafetyDelay = fallbackDelay,
) {
    const isRunning = useRef(false);
    const runCallback = useEffectEvent(callback);
    const [realtimeConnected, setRealtimeConnected] = useState(getRealtimeConnectionState);
    const delay = realtimeConnected ? realtimeSafetyDelay : fallbackDelay;

    useEffect(() => {
        const updateConnectionState = (event: Event) => {
            setRealtimeConnected((event as CustomEvent<boolean>).detail === true);
        };
        window.addEventListener(REALTIME_CONNECTION_STATE_EVENT, updateConnectionState);
        return () => window.removeEventListener(REALTIME_CONNECTION_STATE_EVENT, updateConnectionState);
    }, []);

    useEffect(() => {
        let isActive = true;

        const tick = async () => {
            if (!isActive || isRunning.current) return;
            if (document.visibilityState !== "visible" || !navigator.onLine) return;
            // Skip background polling if there are active write operations (mutations) to prevent race conditions
            if (hasActiveMutations()) return;
            isRunning.current = true;
            try {
                await runCallback();
            } catch (error) {
                console.error("Error in background polling:", error);
            } finally {
                isRunning.current = false;
            }
        };

        const id = window.setInterval(() => {
            void tick();
        }, delay);
        const handleVisible = () => {
            if (document.visibilityState === "visible") void tick();
        };
        window.addEventListener("focus", handleVisible);
        document.addEventListener("visibilitychange", handleVisible);

        return () => {
            isActive = false;
            window.clearInterval(id);
            window.removeEventListener("focus", handleVisible);
            document.removeEventListener("visibilitychange", handleVisible);
        };
    }, [delay]);
}
