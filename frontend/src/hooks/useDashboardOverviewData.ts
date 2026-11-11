"use client";

import { startTransition, useCallback, useEffect, useRef, useState } from "react";
import { ApiResponseError } from "@/lib/api";
import { isPlatformSuperadmin } from "@/domain/access/roles";
import { LocationService, type Location } from "@/services/location.service";
import { TaskService, type TaskItem } from "@/services/task.service";
import type { User } from "@/types/user";

type Snapshot = {
    context: string;
    tasks: TaskItem[];
    locations: Location[];
    tasksLoaded: boolean;
    taskFailed: boolean;
    locationFailed: boolean;
};
const emptySnapshot = (context: string): Snapshot => ({ context, tasks: [], locations: [], tasksLoaded: false, taskFailed: false, locationFailed: false });
const isTransient = (error: unknown) => !(error instanceof ApiResponseError) || error.status >= 500 || error.status === 408 || error.status === 429;
const mergeLocations = (base: Location[], extra: Location[]) => Array.from(new Map([...base, ...extra].map(location => [location.id, location])).values());

/** Owns only the authorized operational snapshot; presentation owns tour and copy. */
export function useDashboardOverviewData(user: User | null) {
    const context = user && !isPlatformSuperadmin(user) ? `${user.id}:${user.company_id ?? "none"}:${user.role?.name ?? "none"}` : null;
    const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
    const snapshotRef = useRef(snapshot);
    const activeContext = useRef<string | null>(null);
    const taskVersion = useRef(0);
    const locationVersion = useRef(0);
    const invalidateRequests = useCallback(() => {
        activeContext.current = null;
        taskVersion.current++;
        locationVersion.current++;
    }, []);

    useEffect(() => { snapshotRef.current = snapshot; }, [snapshot]);
    useEffect(() => {
        activeContext.current = context;
        return invalidateRequests;
    }, [context, invalidateRequests]);

    const loadDashboardTasks = useCallback(async () => {
        if (!context || activeContext.current !== context) return;
        const version = ++taskVersion.current;
        const locationsAtStart = locationVersion.current;
        const readContext = `dashboard-tasks:${context}:${version}`;
        const current = () => activeContext.current === context && version === taskVersion.current;
        try {
            const tasks = await TaskService.getAllTaskItems({}, readContext);
            if (!current()) return;
            const known = snapshotRef.current?.context === context ? snapshotRef.current.locations : [];
            const knownIds = new Set(known.map(location => location.id));
            const missing = [...new Set(tasks.map(task => task.location_id))].filter(id => !knownIds.has(id));
            const details = (await Promise.all(missing.map(id => LocationService.getLocation(id, readContext).catch(() => null))))
                .filter((location): location is Location => location !== null);
            if (!current()) return;
            setSnapshot(previous => {
                const own = previous?.context === context ? previous : emptySnapshot(context);
                return { ...own, tasks, tasksLoaded: true, taskFailed: false,
                    locations: locationsAtStart === locationVersion.current ? mergeLocations(own.locations, details) : own.locations };
            });
        } catch (error) {
            if (!current()) return;
            setSnapshot(previous => {
                const own = previous?.context === context ? previous : emptySnapshot(context);
                return { ...own, tasks: isTransient(error) ? own.tasks : [], tasksLoaded: true, taskFailed: true };
            });
        }
    }, [context]);

    const loadDashboardLocations = useCallback(async () => {
        if (!context || activeContext.current !== context) return;
        const version = ++locationVersion.current;
        const readContext = `dashboard-locations:${context}:${version}`;
        const current = () => activeContext.current === context && version === locationVersion.current;
        try {
            const locations = await LocationService.getLocations(undefined, readContext);
            if (!current()) return;
            setSnapshot(previous => ({ ...(previous?.context === context ? previous : emptySnapshot(context)), locations, locationFailed: false }));
        } catch (error) {
            if (!current()) return;
            setSnapshot(previous => {
                const own = previous?.context === context ? previous : emptySnapshot(context);
                return { ...own, locations: isTransient(error) ? own.locations : [], locationFailed: true };
            });
        }
    }, [context]);

    const loadDashboardData = useCallback(async () => {
        await Promise.all([loadDashboardLocations(), loadDashboardTasks()]);
    }, [loadDashboardLocations, loadDashboardTasks]);

    useEffect(() => { startTransition(() => { void loadDashboardData(); }); }, [loadDashboardData]);

    const own = snapshot?.context === context ? snapshot : null;
    return {
        tasks: own?.tasks ?? [], locations: own?.locations ?? [],
        loadingData: Boolean(context && !own?.tasksLoaded),
        failed: own?.taskFailed === true || own?.locationFailed === true,
        taskFailed: own?.taskFailed === true,
        loadDashboardData, loadDashboardTasks, loadDashboardLocations,
    };
}
