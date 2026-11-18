"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getApiErrorStatus } from "@/lib/read-recovery";
import { ApiResponseError } from "@/lib/api";

/** Owns one recipient's read lifecycle; loaders keep their domain-specific queries. */
export function useNotificationSnapshot<T>(context: string | null, read: (readContext: string) => Promise<T>, onLoaded?: (now: number) => void) {
    const [snapshot, setSnapshot] = useState<{ context: string; value?: T; failed: boolean; loading: boolean } | null>(null);
    const activeContext = useRef<string | null>(null);
    const version = useRef(0);
    useEffect(() => {
        activeContext.current = context;
        return () => { activeContext.current = null; version.current++; };
    }, [context]);

    const load = useCallback(async () => {
        if (!context || activeContext.current !== context) return;
        const request = ++version.current;
        setSnapshot(previous => ({ context, value: previous?.context === context ? previous.value : undefined,
            failed: previous?.context === context && previous.failed, loading: true }));
        try {
            const value = await read(`${context}:${request}`);
            if (request === version.current && activeContext.current === context) {
                setSnapshot({ context, value, failed: false, loading: false });
                onLoaded?.(Date.now());
            }
        } catch (error) {
            const status = getApiErrorStatus(error);
            const transient = status === null || status >= 500 || status === 408 || status === 429;
            const moduleDisabled = status === 402 || (status === 403
                && error instanceof ApiResponseError
                && error.code === "entitlement.feature_not_in_plan");
            if (request === version.current && activeContext.current === context) {
                setSnapshot(previous => ({ context, value: transient && previous?.context === context ? previous.value : undefined,
                    // A disabled plan module contributes no fallback alerts.
                    failed: !moduleDisabled, loading: false }));
            }
        }
    }, [context, onLoaded, read]);

    const owned = context && snapshot?.context === context ? snapshot : null;
    return { value: owned?.value, failed: owned?.failed ?? false, loading: owned?.loading ?? false, load };
}
