"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { isCompanyTaskManagerRole } from "@/domain/access/roles";
import { TaskService, type TaskItem } from "@/services/task.service";

export function useTaskNotificationFeed(enabled: boolean, userId: number | undefined,
    companyId: number | undefined, roleName: string | undefined, onLoaded: (now: number) => void) {
    const context = enabled && userId && companyId ? `${userId}:${companyId}:${roleName ?? "none"}` : null;
    const [snapshot, setSnapshot] = useState<{ context: string; items: TaskItem[] } | null>(null);
    const activeContext = useRef<string | null>(null);
    const version = useRef(0);
    const invalidateRequests = useCallback(() => { activeContext.current = null; version.current++; }, []);

    useEffect(() => {
        activeContext.current = context;
        return invalidateRequests;
    }, [context, invalidateRequests]);

    const loadTaskNotifications = useCallback(async () => {
        if (!context || !userId || activeContext.current !== context) return;
        const request = ++version.current;
        const readContext = `notification-tasks:${context}:${request}`;
        const isManagerOrAdmin = isCompanyTaskManagerRole(roleName);
        const [tasks, requested, rejected] = await Promise.all([
            TaskService.getTaskItems({ userId }, readContext).catch(() => [] as TaskItem[]),
            isManagerOrAdmin ? TaskService.getTaskItems({ status: "requested" }, readContext).catch(() => [] as TaskItem[]) : Promise.resolve([]),
            isManagerOrAdmin ? TaskService.getTaskItems({ status: "rejected" }, readContext).catch(() => [] as TaskItem[]) : Promise.resolve([]),
        ]);
        if (request === version.current && activeContext.current === context) {
            const byId = new Map([...tasks, ...requested, ...rejected].map(task => [task.id, task]));
            setSnapshot({ context, items: Array.from(byId.values()).sort((a, b) => new Date(b.updated_at || b.created_at).getTime() - new Date(a.updated_at || a.created_at).getTime()) });
            onLoaded(Date.now());
        }
    }, [context, onLoaded, roleName, userId]);

    return { notificationTasks: context && snapshot?.context === context ? snapshot.items : [], loadTaskNotifications };
}
