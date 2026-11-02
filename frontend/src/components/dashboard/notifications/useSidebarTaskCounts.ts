"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ApiResponseError } from "@/lib/api";
import { countOperationalPendingTasks } from "@/lib/operational-task-count";
import { TaskService } from "@/services/task.service";

type Counter = "requests" | "tasks";
type Snapshot = { context: string; requests: number; tasks: number };

export function useSidebarTaskCounts(enabled: boolean, userId: number | undefined,
    companyId: number | null | undefined, isManager: boolean, roleName: string | undefined) {
    const context = enabled && userId && companyId ? `${userId}:${companyId}:${roleName ?? "none"}:${isManager ? "manage" : "assigned"}` : null;
    const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
    const activeContext = useRef<string | null>(null);
    const versions = useRef({ requests: 0, tasks: 0 });
    const invalidateRequests = useCallback(() => {
        activeContext.current = null;
        versions.current.requests++;
        versions.current.tasks++;
    }, []);
    useEffect(() => {
        activeContext.current = context;
        return invalidateRequests;
    }, [context, invalidateRequests]);

    const refresh = useCallback(async (kind: Counter) => {
        if (!context || !userId || activeContext.current !== context || (kind === "requests" && !isManager)) return;
        const request = ++versions.current[kind];
        const apply = (count: number) => {
            if (request !== versions.current[kind] || activeContext.current !== context) return;
            setSnapshot(previous => {
                if (activeContext.current !== context) return previous;
                const current = previous?.context === context ? previous : { context, requests: 0, tasks: 0 };
                return { ...current, [kind]: count };
            });
        };
        const readContext = `sidebar-${kind}:${context}:${request}`;
        try {
            if (kind === "requests") {
                const items = await TaskService.getTaskItems({ status: "requested" }, readContext);
                apply(items.filter(task => task.status === "requested").length);
            } else {
                const items = await TaskService.getAllTaskItems({}, readContext);
                apply(countOperationalPendingTasks(items, userId, isManager));
            }
        } catch (error) {
            const transient = !(error instanceof ApiResponseError) || error.status >= 500 || error.status === 408 || error.status === 429;
            if (!transient) apply(0);
        }
    }, [context, isManager, userId]);
    const refreshPending = useCallback(() => refresh("requests"), [refresh]);
    const refreshTasks = useCallback(() => refresh("tasks"), [refresh]);
    const owned = context && snapshot?.context === context ? snapshot : null;
    return { pendingRequestsCount: isManager ? owned?.requests ?? 0 : 0,
        taskPendingCount: owned?.tasks ?? 0, refreshPending, refreshTasks };
}
