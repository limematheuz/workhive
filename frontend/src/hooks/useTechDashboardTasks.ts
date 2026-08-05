"use client";

import { useCallback, useMemo } from "react";

import { canManageCompanyTasks } from "@/domain/access/roles";
import {
    getTasksForOverviewTab,
    isTaskOverdue,
    sortTasksByOperationalPriority,
    type OverviewTab,
} from "@/domain/tasks/task-schedule";
import {
    isOperationalStatus,
    normalizeTaskStatus,
} from "@/domain/tasks/task-status";
import { getUserTaskStatus } from "@/lib/format";
import { isTaskPendingInOperationalOverview } from "@/lib/operational-task-count";
import type { Location } from "@/types/location";
import type { TaskStatus } from "@/types/task";
import type { TaskItem, User } from "@/types/user";

export interface TasksByLocation {
    location: Location;
    overdue: TaskItem[];
    standard: TaskItem[];
}

interface UseTechDashboardTasksParams {
    activeTab: OverviewTab;
    currentUser: User;
    locations: Location[];
    tasks: TaskItem[];
}

export function useTechDashboardTasks({
    activeTab,
    currentUser,
    locations,
    tasks,
}: UseTechDashboardTasksParams) {
    const canManage = canManageCompanyTasks(currentUser);
    const locationMap = useMemo(
        () => new Map(locations.map((location) => [location.id, location])),
        [locations],
    );
    const getLocationName = useCallback(
        (locationId: number) => (
            locationMap.get(locationId)?.name || `Ubicación #${locationId}`
        ),
        [locationMap],
    );
    const getEffectiveStatus = useCallback(
        (task: TaskItem): TaskStatus => (
            canManage
                ? normalizeTaskStatus(task.status)
                : getUserTaskStatus(task, currentUser.id)
        ),
        [canManage, currentUser.id],
    );

    const operationalTasks = useMemo(
        () => tasks.filter((task) => isOperationalStatus(task.status)),
        [tasks],
    );
    const activeTasks = useMemo(
        () => operationalTasks.filter((task) => (
            isTaskPendingInOperationalOverview(task, currentUser.id, canManage)
        )),
        [canManage, currentUser.id, operationalTasks],
    );
    const tasksByTab = useMemo(() => {
        const now = new Date();
        return {
            hoy: getTasksForOverviewTab(activeTasks, "hoy", now),
            manana: getTasksForOverviewTab(activeTasks, "manana", now),
            semana: getTasksForOverviewTab(activeTasks, "semana", now),
            todo: getTasksForOverviewTab(activeTasks, "todo", now),
        } satisfies Record<OverviewTab, TaskItem[]>;
    }, [activeTasks]);
    const visibleTasks = tasksByTab[activeTab];

    const { overdueTasks, standardTasks } = useMemo(() => {
        const overdue: TaskItem[] = [];
        const standard: TaskItem[] = [];
        sortTasksByOperationalPriority(visibleTasks).forEach((task) => {
            if (isTaskOverdue(task)) overdue.push(task);
            else standard.push(task);
        });
        return { overdueTasks: overdue, standardTasks: standard };
    }, [visibleTasks]);

    const tasksByLocation = useMemo(() => {
        const grouped = new Map<number, TasksByLocation>();
        const groupTask = (task: TaskItem, bucket: "overdue" | "standard") => {
            const location = locationMap.get(task.location_id) || {
                id: task.location_id,
                name: `Ubicación #${task.location_id}`,
                address: "",
                city: "",
                is_active: true,
            };
            const group = grouped.get(task.location_id) || {
                location,
                overdue: [],
                standard: [],
            };
            group[bucket].push(task);
            grouped.set(task.location_id, group);
        };
        overdueTasks.forEach((task) => groupTask(task, "overdue"));
        standardTasks.forEach((task) => groupTask(task, "standard"));
        return Array.from(grouped.values());
    }, [locationMap, overdueTasks, standardTasks]);

    const countPendingForTab = useCallback(
        (tab: OverviewTab) => tasksByTab[tab].length,
        [tasksByTab],
    );

    const activeLocationIds = useMemo(
        () => new Set(activeTasks.map((task) => task.location_id)),
        [activeTasks],
    );
    const activeLocations = useMemo(
        () => locations.filter((location) => activeLocationIds.has(location.id)),
        [activeLocationIds, locations],
    );

    return {
        activeLocations,
        activeTasks,
        canManage,
        countPendingForTab,
        getEffectiveStatus,
        getLocationName,
        operationalTasks,
        overdueTasks,
        pendingCount: activeTasks.length,
        resolvedCount: operationalTasks.filter(
            (task) => getEffectiveStatus(task) === "completed",
        ).length,
        standardTasks,
        tasksByLocation,
    };
}
