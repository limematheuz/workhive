"use client";

import { startTransition, useCallback, useEffect, useRef, useState } from "react";
import { ApiResponseError } from "@/lib/api";
import { WorkSessionService, type WorkSession } from "@/services/work-session.service";
import type { User } from "@/types/user";

type Snapshot = { context: string; session: WorkSession | null; failed: boolean };

export function useActiveWorkSession(user: User | null) {
    const context = user ? `${user.id}:${user.company_id ?? "none"}:${user.role?.name ?? "none"}` : null;
    const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
    const activeContext = useRef<string | null>(null);
    const version = useRef(0);
    const invalidate = useCallback(() => { activeContext.current = null; version.current++; }, []);

    const refreshSession = useCallback(async () => {
        if (!context || activeContext.current !== context) return;
        const request = ++version.current;
        try {
            const session = await WorkSessionService.getActiveSession(`shift:${context}:${request}`);
            if (activeContext.current === context && version.current === request) setSnapshot({ context, session, failed: false });
        } catch (error) {
            if (activeContext.current !== context || version.current !== request) return;
            const transient = !(error instanceof ApiResponseError) || error.status >= 500 || error.status === 408 || error.status === 429;
            setSnapshot(previous => ({ context, session: transient && previous?.context === context ? previous.session : null, failed: true }));
        }
    }, [context]);

    useEffect(() => {
        activeContext.current = context;
        startTransition(() => { void refreshSession(); });
        return invalidate;
    }, [context, invalidate, refreshSession]);

    const setActiveSession = useCallback((session: WorkSession | null) => {
        if (!context || activeContext.current !== context) return;
        version.current++;
        setSnapshot({ context, session, failed: false });
    }, [context]);
    const own = snapshot?.context === context ? snapshot : null;
    return { activeSession: own?.session ?? null, loading: Boolean(context && !own), sessionFailed: own?.failed === true, refreshSession, setActiveSession };
}
