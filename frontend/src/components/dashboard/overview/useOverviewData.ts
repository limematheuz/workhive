"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { WorkSessionService } from "@/services/work-session.service";
import { UserService } from "@/services/user.service";
import { QualityService, type QualityIncident } from "@/services/quality.service";
import { collectPaginated } from "@/lib/pagination";
import { canManageTime, canViewQuality } from "@/domain/access/roles";
import { useBackgroundPolling } from "@/hooks/useBackgroundPolling";
import { useRealtimeInvalidation } from "@/hooks/useRealtimeEvents";
import { POLL_INTERVALS } from "@/lib/polling";
import type { ActiveCompanySession, User } from "@/types/user";

export type OverviewResource<T> = { value: T; state: "loading" | "ready" | "error" | "denied" };
const loading = <T,>(value: T): OverviewResource<T> => ({ value, state: "loading" });

export function useOverviewData(user: User) {
    const [sessions, setSessions] = useState(() => loading<ActiveCompanySession[]>([]));
    const [users, setUsers] = useState(() => loading<User[]>([]));
    const [incidents, setIncidents] = useState(() => loading<QualityIncident[]>([]));
    const generation = useRef<object | null>(null);
    const queryKey = `${user.id}:${user.company_id}`;
    const [loadedKey, setLoadedKey] = useState("");
    const reload = useCallback(async () => {
        const request = {};
        generation.current = request;
        const read = async <T,>(job: () => Promise<T>, fallback: T, set: (data: OverviewResource<T>) => void) => {
            try { const value = await job(); if (request === generation.current) set({ value, state: "ready" }); }
            catch { if (request === generation.current) set({ value: fallback, state: "error" }); }
        };
        await Promise.all([
            canManageTime(user) ? read(() => WorkSessionService.getActiveCompanySessions(), [], setSessions) : Promise.resolve(setSessions({ value: [], state: "denied" })),
            read(() => collectPaginated((skip, limit) => UserService.getUsers(skip, limit)), [], setUsers),
            canViewQuality(user) ? read(async () => {
                const access = await QualityService.getAccess();
                if (!access.sections.incidents.can_read) { if (request === generation.current) setIncidents({ value: [], state: "denied" }); return null; }
                return QualityService.getIncidents();
            }, null, result => { if (result.value !== null) setIncidents({ ...result, value: result.value }); else if (result.state === "error") setIncidents({ value: [], state: "error" }); }) : Promise.resolve(setIncidents({ value: [], state: "denied" })),
        ]);
    }, [user]);

    useEffect(() => {
        const timer = window.setTimeout(() => {
            setSessions(loading([]));
            setUsers(loading([]));
            setIncidents(loading([]));
            setLoadedKey(queryKey);
            void reload();
        }, 0);
        return () => { window.clearTimeout(timer); generation.current = null; };
    }, [reload, queryKey]);
    useBackgroundPolling(reload, POLL_INTERVALS.dashboard, POLL_INTERVALS.realtimeSafety);
    useRealtimeInvalidation(["live-work", "tasks", "dashboard"], () => { void reload(); });
    const current = loadedKey === queryKey;
    return { sessions: current ? sessions : loading<ActiveCompanySession[]>([]), users: current ? users : loading<User[]>([]), incidents: current ? incidents : loading<QualityIncident[]>([]), reload };
}
