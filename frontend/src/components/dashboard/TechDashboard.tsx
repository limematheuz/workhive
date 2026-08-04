"use client";

import React, { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { CheckSquare, Calendar, MapPin, Loader2, LayoutDashboard } from "lucide-react";
import { User, TaskItem } from "@/types/user";
import { Location } from "@/services/location.service";
import { useDictionary } from "@/lib/dictionary-context";
import { TechTaskCard } from "./TechTaskCard";
import { TechTaskDetails } from "./TechTaskDetails";
import { WorkSessionWidget } from "./WorkSessionWidget";
import { TaskService } from "@/services/task.service";
import { toast } from "@/lib/toast";
import { PageHeader } from "@/components/ui/page-header";
import { PremiumTabs } from "@/components/ui/premium-tabs";
import {
    getUserChecklistItems,
    setChecklistAssigneeStatus,
    UserTaskStatus,
} from "@/lib/format";
import {
    getOverviewTabForDate,
    type OverviewTab,
} from "@/domain/tasks/task-schedule";
import { useTechDashboardTasks } from "@/hooks/useTechDashboardTasks";
import { canManageCompanyTasks as canManageTasks } from "@/domain/access/roles";
import { useTaskWorkSummaries } from "@/hooks/useTaskWorkSummaries";
import { dismissTaskNotification } from "./notifications/notification-utils";

interface TechDashboardProps {
    currentUser: User;
    tasks: TaskItem[];
    locations: Location[];
    onTaskUpdate: () => void;
}

const DETAIL_HISTORY_KEY = "techTaskDetail";

function TechDashboardInner({
    currentUser,
    tasks,
    locations,
    onTaskUpdate,
}: TechDashboardProps) {
    const { dict } = useDictionary();
    const searchParams = useSearchParams();
    const notificationKey = `${searchParams.get("taskId") || ""}-${searchParams.get("taskDate") || ""}`;
    const notificationDate = searchParams.get("taskDate");
    const preliminaryCanManage = canManageTasks(currentUser);
    const notificationTab = notificationDate
        ? getOverviewTabForDate(notificationDate)
        : preliminaryCanManage ? "semana" : "hoy";
    const [manualTabSelection, setManualTabSelection] = useState<{ tab: OverviewTab; notificationKey: string } | null>(null);
    const activeTab = manualTabSelection?.notificationKey === notificationKey ? manualTabSelection.tab : notificationTab;
    const [selectedTaskId, setSelectedTaskId] = useState<number | null>(null);
    const detailHistoryOpenRef = useRef(false);
    const dashboardTasks = useTechDashboardTasks({
        activeTab,
        currentUser,
        locations,
        tasks,
    });
    const canManageCompanyTasks = dashboardTasks.canManage;
    const workSummaries = useTaskWorkSummaries([
        ...dashboardTasks.overdueTasks,
        ...dashboardTasks.standardTasks,
    ]);

    const selectedTask = useMemo(() => {
        if (selectedTaskId === null) return null;
        return tasks.find(task => task.id === selectedTaskId) || null;
    }, [tasks, selectedTaskId]);

    const selectedTaskLocation = useMemo(() => {
        if (!selectedTask) return null;
        return locations.find(loc => loc.id === selectedTask.location_id) || null;
    }, [selectedTask, locations]);

    const openTaskDetail = useCallback((task: TaskItem) => {
        dismissTaskNotification(currentUser.id, task);
        setSelectedTaskId(task.id);
        if (!detailHistoryOpenRef.current) {
            window.history.pushState({ [DETAIL_HISTORY_KEY]: task.id }, "");
            detailHistoryOpenRef.current = true;
        }
    }, [currentUser.id]);

    const closeTaskDetail = useCallback(() => {
        setSelectedTaskId(null);
        if (
            detailHistoryOpenRef.current
            && window.history.state
            && typeof window.history.state === "object"
            && DETAIL_HISTORY_KEY in window.history.state
        ) {
            detailHistoryOpenRef.current = false;
            window.history.back();
            return;
        }
        detailHistoryOpenRef.current = false;
    }, []);

    useEffect(() => {
        const onPopState = () => {
            detailHistoryOpenRef.current = false;
            setSelectedTaskId(null);
        };
        window.addEventListener("popstate", onPopState);
        return () => window.removeEventListener("popstate", onPopState);
    }, []);

    const getTasksCountLabel = (count: number) => {
        const template = (dict.tech as typeof dict.tech & { tasks_count?: string }).tasks_count;
        return template ? template.replace("{count}", count.toString()) : `${count} tareas`;
    };

    const updateUserTaskStatus = async (task: TaskItem, nextStatus: UserTaskStatus) => {
        if (canManageCompanyTasks && ["accepted", "rejected"].includes(nextStatus)) {
            await TaskService.updateTaskItem(task.id, { status: nextStatus });
            return;
        }

        const ownAssignedItems = getUserChecklistItems(task, currentUser.id)
            .filter(item => item.assignedUserId === currentUser.id);

        if (ownAssignedItems.length > 0) {
            const updated = setChecklistAssigneeStatus(task.description, currentUser.id, nextStatus);
            if (updated.updatedCount > 0) {
                await TaskService.updateTaskItem(task.id, { description: updated.description });
                return;
            }
        }

        if (task.user_id === currentUser.id) {
            await TaskService.updateTaskItem(task.id, { status: nextStatus });
            return;
        }

        throw new Error("No matching assignment found for this status update");
    };

    const handleAccept = async (taskId: number) => {
        if (!canManageCompanyTasks) return;
        const task = tasks.find(t => t.id === taskId);
        if (!task) return;

        try {
            await updateUserTaskStatus(task, "accepted");
            toast.success(dict.tech.toast_accept_success);
            window.dispatchEvent(new CustomEvent("workhive:tasks-changed"));
            onTaskUpdate();
        } catch (error) {
            console.error("Error accepting task", error);
            toast.error(dict.tech.toast_accept_error);
        }
    };

    const handleReject = async (taskId: number) => {
        if (!canManageCompanyTasks) return;
        const task = tasks.find(t => t.id === taskId);
        if (!task) return;

        try {
            await updateUserTaskStatus(task, "rejected");
            toast.success(dict.tech.toast_reject_success);
            window.dispatchEvent(new CustomEvent("workhive:tasks-changed"));
            onTaskUpdate();
        } catch (error) {
            console.error("Error rejecting task", error);
            toast.error(dict.tech.toast_reject_error);
        }
    };

    const handleStatusUpdate = () => {
        onTaskUpdate();
    };

    return (
        <>
            <div className="mx-auto flex max-w-7xl animate-fade-in flex-col gap-8 p-4 pb-24 text-[var(--text-main)] sm:p-6 md:pb-6">
                <PageHeader
                    icon={LayoutDashboard}
                    title={dict.tech.portal_title}
                    subtitle={dict.tech.portal_subtitle}
                    actions={(
                        <div className="flex items-center gap-2 rounded-xl border border-[var(--border-soft)] bg-[var(--bg-primary)]/40 px-3 py-1.5 text-2xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
                            <span>{dict.tech.pending}: {dashboardTasks.pendingCount}</span>
                            <span>•</span>
                            <span className="text-accent">{dict.tech.resolved}: {dashboardTasks.resolvedCount}</span>
                        </div>
                    )}
                />

                <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-3">
                    <div className="space-y-6 lg:col-span-2">
                        <PremiumTabs
                            layout="fit"
                            tabs={[
                                { id: "hoy", label: dict.tech.tab_today, badge: dashboardTasks.countPendingForTab("hoy") },
                                { id: "manana", label: dict.tech.tab_tomorrow, badge: dashboardTasks.countPendingForTab("manana") },
                                { id: "semana", label: dict.tech.tab_week, badge: dashboardTasks.countPendingForTab("semana") },
                                { id: "todo", label: dict.tech.tab_all, badge: dashboardTasks.countPendingForTab("todo") },
                            ]}
                            activeTab={activeTab}
                            onChange={(tabId) => setManualTabSelection({ tab: tabId, notificationKey })}
                        />

                        {dashboardTasks.standardTasks.length === 0 && dashboardTasks.overdueTasks.length === 0 ? (
                            <div className="rounded-2xl border border-dashed border-[var(--border-soft)] bg-[var(--bg-card)]/30 py-20 text-center">
                                <CheckSquare className="mx-auto mb-3 h-10 w-10 text-[var(--text-main)] opacity-20" />
                                <p className="text-sm font-semibold text-[var(--text-muted)]">
                                    {dict.tech.no_scheduled_tasks}
                                </p>
                            </div>
                        ) : (
                            <div className="space-y-6">
                                {dashboardTasks.tasksByLocation.map(item => (
                                    <div key={item.location.id} className="space-y-4 rounded-2xl border border-[var(--border-soft)] bg-[var(--bg-card)] p-6 shadow-sm ui-motion hover:shadow-md">
                                        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border-soft)] pb-3">
                                            <div className="flex items-center gap-2.5">
                                                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-accent/20 bg-accent/10 text-[var(--text-main)]">
                                                    <MapPin className="h-4 w-4 text-[var(--text-main)]" />
                                                </div>
                                                <div>
                                                    <h3 className="text-sm font-black text-[var(--text-main)]">
                                                        {item.location.name}
                                                    </h3>
                                                    {item.location.address && (
                                                        <p className="mt-0.5 text-3xs font-medium text-[var(--text-muted)]">
                                                            {item.location.address}
                                                        </p>
                                                    )}
                                                </div>
                                            </div>
                                            <span className="rounded-md border border-[var(--border-soft)] bg-[var(--bg-primary)] px-2 py-0.5 text-3xs font-bold text-[var(--text-muted)]">
                                                {getTasksCountLabel(item.overdue.length + item.standard.length)}
                                            </span>
                                        </div>

                                        <div className="space-y-3">
                                            {item.overdue.map(task => (
                                                <TechTaskCard
                                                    key={task.id}
                                                    task={task}
                                                    locationName={item.location.name}
                                                    locationAddress={item.location.address || item.location.city}
                                                    currentUser={currentUser}
                                                    onAccept={handleAccept}
                                                    onReject={handleReject}
                                                    onViewDetails={openTaskDetail}
                                                    hideLocationName={true}
                                                    workSummary={workSummaries[task.id]}
                                                />
                                            ))}

                                            {item.standard.map(task => (
                                                <TechTaskCard
                                                    key={task.id}
                                                    task={task}
                                                    locationName={item.location.name}
                                                    locationAddress={item.location.address || item.location.city}
                                                    currentUser={currentUser}
                                                    onAccept={handleAccept}
                                                    onReject={handleReject}
                                                    onViewDetails={openTaskDetail}
                                                    hideLocationName={true}
                                                    workSummary={workSummaries[task.id]}
                                                />
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="space-y-6">
                        <div className="space-y-4 rounded-2xl border border-[var(--border-soft)] bg-[var(--bg-card)] p-6 shadow-sm">
                            <div className="flex items-center gap-2.5 border-b border-[var(--border-soft)] pb-2">
                                <Calendar className="h-4.5 w-4.5 text-[var(--text-main)]" />
                                <h3 className="text-sm font-bold text-[var(--text-main)]">{dict.tech.shift_clock}</h3>
                            </div>
                            <WorkSessionWidget allowedLocations={dashboardTasks.activeLocations} />
                        </div>
                    </div>
                </div>
            </div>

            {selectedTask && (
                <TechTaskDetails
                    task={selectedTask}
                    location={selectedTaskLocation}
                    locationName={dashboardTasks.getLocationName(selectedTask.location_id)}
                    currentUser={currentUser}
                    onBack={closeTaskDetail}
                    onStatusUpdate={handleStatusUpdate}
                />
            )}
        </>
    );
}

export function TechDashboard(props: TechDashboardProps) {
    return (
        <Suspense
            fallback={
                <div className="flex min-h-[400px] flex-col items-center justify-center gap-3">
                    <Loader2 className="h-8 w-8 animate-spin text-accent" />
                </div>
            }
        >
            <TechDashboardInner {...props} />
        </Suspense>
    );
}
