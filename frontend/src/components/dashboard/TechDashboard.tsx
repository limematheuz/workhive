"use client";

import React, { Suspense, useState, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { CheckSquare, Calendar, MapPin, Loader2 } from "lucide-react";
import { User, TaskItem } from "@/types/user";
import { Location } from "@/services/location.service";
import { useDictionary } from "@/lib/dictionary-context";
import { TechTaskCard } from "./TechTaskCard";
import { TechTaskDetails } from "./TechTaskDetails";
import { WorkSessionWidget } from "./WorkSessionWidget";
import { TaskService } from "@/services/task.service";
import { toast } from "@/lib/toast";
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

interface TechDashboardProps {
    currentUser: User;
    tasks: TaskItem[];
    locations: Location[];
    onTaskUpdate: () => void;
}

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
    const dashboardTasks = useTechDashboardTasks({
        activeTab,
        currentUser,
        locations,
        tasks,
    });
    const canManageCompanyTasks = dashboardTasks.canManage;

    const selectedTask = useMemo(() => {
        if (selectedTaskId === null) return null;
        return tasks.find(task => task.id === selectedTaskId) || null;
    }, [tasks, selectedTaskId]);

    const selectedTaskLocation = useMemo(() => {
        if (!selectedTask) return null;
        return locations.find(loc => loc.id === selectedTask.location_id) || null;
    }, [selectedTask, locations]);

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
            // Update the @userId tag with the new status (rejected, accepted, etc.).
            // The tag is kept so the task remains visible and traceable in the dashboard.
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

    if (selectedTask) {
        return (
            <div className="py-4">
                <TechTaskDetails
                    task={selectedTask}
                    location={selectedTaskLocation}
                    locationName={dashboardTasks.getLocationName(selectedTask.location_id)}
                    currentUser={currentUser}
                    onBack={() => setSelectedTaskId(null)}
                    onStatusUpdate={handleStatusUpdate}
                />
            </div>
        );
    }

    return (
        <div className="max-w-7xl mx-auto flex flex-col gap-8 text-[var(--text-main)] p-4 sm:p-6 pb-24 md:pb-6 animate-fade-in">
            {/* Header section */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-[var(--border-soft)] pb-5">
                <div className="space-y-1">
                    <h1 className="text-2xl font-black tracking-tight text-[var(--text-main)] flex items-center gap-2">
                        {dict.tech.portal_title}
                    </h1>
                    <p className="text-xs text-[var(--text-muted)] font-medium">
                        {dict.tech.portal_subtitle}
                    </p>
                </div>

                {/* Task Totals badges */}
                <div className="flex items-center gap-2 bg-[var(--bg-primary)]/40 px-3 py-1.5 border border-[var(--border-soft)] rounded-xl text-2xs font-bold text-[var(--text-muted)] uppercase tracking-wider">
                    <span>{dict.tech.pending}: {dashboardTasks.pendingCount}</span>
                    <span>•</span>
                    <span className="text-accent">{dict.tech.resolved}: {dashboardTasks.resolvedCount}</span>
                </div>
            </div>

            {/* Main view grid split: task list and work session tracker sidebar */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
                
                {/* 2/3 column: Date Switcher and Tasks List */}
                <div className="lg:col-span-2 space-y-6">
                    {/* Premium Date Tab Switcher */}
                    <PremiumTabs
                        tabs={[
                            { id: "hoy", label: dict.tech.tab_today, badge: dashboardTasks.countPendingForTab("hoy") },
                            { id: "manana", label: dict.tech.tab_tomorrow, badge: dashboardTasks.countPendingForTab("manana") },
                            { id: "semana", label: dict.tech.tab_week, badge: dashboardTasks.countPendingForTab("semana") },
                            { id: "todo", label: dict.tech.tab_all, badge: dashboardTasks.countPendingForTab("todo") }
                        ]}
                        activeTab={activeTab}
                        onChange={(tabId) => setManualTabSelection({ tab: tabId, notificationKey })}
                    />

                    {/* PROPERTIES FEED */}
                    {dashboardTasks.standardTasks.length === 0 && dashboardTasks.overdueTasks.length === 0 ? (
                        <div className="text-center py-20 bg-[var(--bg-card)]/30 border border-dashed border-[var(--border-soft)] rounded-2xl">
                            <CheckSquare className="w-10 h-10 text-[var(--text-main)] opacity-20 mx-auto mb-3" />
                            <p className="text-sm font-semibold text-[var(--text-muted)]">
                                {dict.tech.no_scheduled_tasks}
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-6">
                            {dashboardTasks.tasksByLocation.map(item => (
                                <div key={item.location.id} className="bg-[var(--bg-card)] border border-[var(--border-soft)] rounded-2xl p-6 shadow-sm hover:shadow-md transition-all space-y-4">
                                    {/* Property header */}
                                    <div className="flex items-center justify-between pb-3 border-b border-[var(--border-soft)] flex-wrap gap-2">
                                        <div className="flex items-center gap-2.5">
                                            <div className="w-9 h-9 rounded-xl bg-accent/10 border border-accent/20 flex items-center justify-center text-[var(--text-main)] shrink-0">
                                                <MapPin className="w-4 h-4 text-[var(--text-main)]" />
                                            </div>
                                            <div>
                                                <h3 className="text-sm font-black text-[var(--text-main)]">
                                                    {item.location.name}
                                                </h3>
                                                {item.location.address && (
                                                    <p className="text-3xs text-[var(--text-muted)] font-medium mt-0.5">
                                                        {item.location.address}
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                        <span className="text-3xs bg-[var(--bg-primary)] px-2 py-0.5 rounded-md font-bold text-[var(--text-muted)] border border-[var(--border-soft)]">
                                            {getTasksCountLabel(item.overdue.length + item.standard.length)}
                                        </span>
                                    </div>

                                    {/* Property task checklist */}
                                    <div className="space-y-3">
                                        {/* Overdue property tasks */}
                                        {item.overdue.map(task => (
                                            <TechTaskCard
                                                key={task.id}
                                                task={task}
                                                locationName={item.location.name}
                                                locationAddress={item.location.address || item.location.city}
                                                currentUser={currentUser}
                                                onAccept={handleAccept}
                                                onReject={handleReject}
                                                onViewDetails={(task) => setSelectedTaskId(task.id)}
                                                hideLocationName={true}
                                            />
                                        ))}

                                        {/* Standard property tasks */}
                                        {item.standard.map(task => (
                                            <TechTaskCard
                                                key={task.id}
                                                task={task}
                                                locationName={item.location.name}
                                                locationAddress={item.location.address || item.location.city}
                                                currentUser={currentUser}
                                                onAccept={handleAccept}
                                                onReject={handleReject}
                                                onViewDetails={(task) => setSelectedTaskId(task.id)}
                                                hideLocationName={true}
                                            />
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* 1/3 column: Work Session widget sidebar */}
                <div className="space-y-6">
                    <div className="bg-[var(--bg-card)] border border-[var(--border-soft)] rounded-2xl p-6 shadow-sm space-y-4">
                        <div className="flex items-center gap-2.5 pb-2 border-b border-[var(--border-soft)]">
                            <Calendar className="w-4.5 h-4.5 text-[var(--text-main)]" />
                            <h3 className="text-sm font-bold text-[var(--text-main)]">{dict.tech.shift_clock}</h3>
                        </div>
                        <WorkSessionWidget allowedLocations={dashboardTasks.activeLocations} />
                    </div>
                </div>

            </div>
        </div>
    );
}

export function TechDashboard(props: TechDashboardProps) {
    return (
        <Suspense
            fallback={
                <div className="flex flex-col items-center justify-center min-h-[400px] gap-3">
                    <Loader2 className="w-8 h-8 text-accent animate-spin" />
                </div>
            }
        >
            <TechDashboardInner {...props} />
        </Suspense>
    );
}
