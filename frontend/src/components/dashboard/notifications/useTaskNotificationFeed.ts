"use client";

import { useCallback } from "react";
import { TaskService } from "@/services/task.service";
import { useNotificationSnapshot } from "./useNotificationSnapshot";

export function useTaskNotificationFeed(enabled: boolean, userId: number | undefined,
    companyId: number | undefined, roleName: string | undefined, canManageTasks: boolean, onLoaded: (now: number) => void) {
    const context = enabled && userId && companyId ? `${userId}:${companyId}:${roleName ?? "none"}:${canManageTasks ? "manage" : "read"}` : null;
    const read = useCallback(async (readContext: string) => {
        const notificationContext = `notification-tasks:${readContext}`;
        const [tasks, requested, rejected] = await Promise.all([
            TaskService.getAllTaskItems({ userId }, notificationContext),
            canManageTasks ? TaskService.getAllTaskItems({ status: "requested" }, notificationContext) : Promise.resolve([]),
            canManageTasks ? TaskService.getAllTaskItems({ status: "rejected" }, notificationContext) : Promise.resolve([]),
        ]);
        const byId = new Map([...tasks, ...requested, ...rejected].map(task => [task.id, task]));
        return Array.from(byId.values()).sort((a, b) => new Date(b.updated_at || b.created_at).getTime() - new Date(a.updated_at || a.created_at).getTime());
    }, [canManageTasks, userId]);
    const feed = useNotificationSnapshot(context, read, onLoaded);
    return { notificationTasks: feed.value ?? [], loadTaskNotifications: feed.load,
        taskLoadFailed: feed.failed, taskLoading: feed.loading };
}
