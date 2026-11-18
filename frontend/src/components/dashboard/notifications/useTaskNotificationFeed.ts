"use client";

import { useCallback } from "react";
import { isCompanyTaskManagerRole } from "@/domain/access/roles";
import { TaskService } from "@/services/task.service";
import { useNotificationSnapshot } from "./useNotificationSnapshot";

export function useTaskNotificationFeed(enabled: boolean, userId: number | undefined,
    companyId: number | undefined, roleName: string | undefined, onLoaded: (now: number) => void) {
    const context = enabled && userId && companyId ? `${userId}:${companyId}:${roleName ?? "none"}` : null;
    const read = useCallback(async (readContext: string) => {
        const isManagerOrAdmin = isCompanyTaskManagerRole(roleName);
        const notificationContext = `notification-tasks:${readContext}`;
        const [tasks, requested, rejected] = await Promise.all([
            TaskService.getAllTaskItems({ userId }, notificationContext),
            isManagerOrAdmin ? TaskService.getAllTaskItems({ status: "requested" }, notificationContext) : Promise.resolve([]),
            isManagerOrAdmin ? TaskService.getAllTaskItems({ status: "rejected" }, notificationContext) : Promise.resolve([]),
        ]);
        const byId = new Map([...tasks, ...requested, ...rejected].map(task => [task.id, task]));
        return Array.from(byId.values()).sort((a, b) => new Date(b.updated_at || b.created_at).getTime() - new Date(a.updated_at || a.created_at).getTime());
    }, [roleName, userId]);
    const feed = useNotificationSnapshot(context, read, onLoaded);
    return { notificationTasks: feed.value ?? [], loadTaskNotifications: feed.load,
        taskLoadFailed: feed.failed, taskLoading: feed.loading };
}
