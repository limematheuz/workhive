import { useEffect, useEffectEvent, useRef } from "react";
import { hasActiveMutations } from "@/lib/api";

export function useBackgroundPolling(
    callback: () => Promise<void> | void,
    delay: number
) {
    const isRunning = useRef(false);
    const runCallback = useEffectEvent(callback);

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
