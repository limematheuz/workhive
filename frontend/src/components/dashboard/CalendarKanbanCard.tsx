"use client";

import React from "react";
import { CheckCircle2, FileText, Hammer, Loader2, Lock, MessageCircle, MoreHorizontal, Timer, TriangleAlert, UserRound } from "lucide-react";
import { TaskItem, TaskWorkDetailedSummary } from "@/types/user";
import { useDictionary } from "@/lib/dictionary-context";
import { cleanChecklistDescription } from "@/lib/format";
import { formatHoursShort } from "@/lib/format-hours";
import { localizeTaskDescription, taskLocationTitle } from "@/lib/task-display";
import { getTaskChecklistProgress } from "@/lib/task-checklist-completion";
import { TaskProgressBar } from "@/components/tasks/TaskProgressBar";
import {
    getCalendarKanbanAssignee,
    parseCalendarKanbanChecklist,
} from "./calendar-kanban-card-utils";

interface CalendarKanbanCardProps {
    task: TaskItem;
    updating: boolean;
    getUserInitials: (userId: number | null) => { initials: string; bgColor: string };
    getUserFullName: (userId: number | null) => string;
    getLocationName: (locId: number) => string;
    onDragStart: (e: React.DragEvent, taskId: number) => void;
    onClick: (task: TaskItem) => void;
    isExternal?: boolean;
    canDrag?: boolean;
    workSummary?: TaskWorkDetailedSummary;
}

export function CalendarKanbanCard({
    task,
    updating,
    getUserInitials,
    getUserFullName,
    getLocationName,
    onDragStart,
    onClick,
    isExternal = false,
    canDrag = true,
    workSummary,
}: CalendarKanbanCardProps) {
    const { dict } = useDictionary();
    const assignee = getCalendarKanbanAssignee(
        task,
        getUserFullName,
        getUserInitials,
        dict.tasks?.kanban?.accepted_by || "Aceptada por",
    );
    const locationName = getLocationName(task.location_id);
    const isCompleted = task.status === "completed";
    const localizedDescription = localizeTaskDescription(task.description);
    const displayTitle = taskLocationTitle(task, locationName);
    const isActiveStatus = task.status === "progress" || task.status === "accepted" || task.status === "review";
    const statusTone = isCompleted
        ? {
            Icon: CheckCircle2,
            card: "border-accent/35 bg-accent/5 hover:border-accent/55 hover:shadow-[0_18px_38px_rgba(37,99,235,0.14)]",
            bar: "bg-accent",
            icon: "text-accent",
            label: dict.tasks?.dialog?.status_completed || "Completada",
        }
        : isActiveStatus
            ? {
                Icon: Hammer,
                card: "border-accent/35 bg-accent/5 hover:border-accent/55 hover:shadow-[0_18px_38px_rgba(37,99,235,0.14)]",
                bar: "bg-accent",
                icon: "text-accent",
                label: dict.tasks?.dialog?.status_progress || "En progreso",
            }
            : {
                Icon: TriangleAlert,
                card: "border-orange-500/35 bg-orange-500/5 hover:border-orange-500/55 hover:shadow-[0_18px_38px_rgba(217,119,6,0.14)]",
                bar: "bg-orange-500",
                icon: "text-orange-600",
                label: dict.tasks?.dialog?.status_pending || "Pendiente",
            };
    const StatusIcon = statusTone.Icon;

    const checklist = parseCalendarKanbanChecklist(localizedDescription);
    const checklistProgress = getTaskChecklistProgress(task);
    const progress = checklistProgress.total > 0
        ? checklistProgress
        : {
            completed: task.status === "completed" ? 1 : 0,
            total: 1,
        };

    const computedPriority = task.priority || "medium";

    return (
        <article
            draggable={canDrag && !task.is_invoiced && !updating}
            onDragStart={(e) => onDragStart(e, task.id)}
            className={`rounded-2xl border bg-[var(--bg-card)] shadow-[0_2px_8px_var(--shadow-color)] ui-motion select-none group relative flex flex-col justify-between overflow-hidden ${statusTone.card} ${
                task.is_invoiced
                    ? "opacity-85 cursor-default hover:border-[var(--border-soft)]"
                    : canDrag ? "cursor-grab active:cursor-grabbing" : "cursor-pointer"
            }`}
        >
            <button
                type="button"
                onClick={() => onClick(task)}
                aria-label={`Abrir tarea: ${task.title}`}
                className="absolute inset-0 z-0 rounded-2xl focus-visible:z-20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            />
            {updating && (
                <div className="absolute inset-0 bg-[var(--bg-card)]/70 backdrop-blur-xs flex items-center justify-center z-30 rounded-xl">
                    <Loader2 className="w-4 h-4 text-accent animate-spin" />
                </div>
            )}

            <div className="relative z-10 pointer-events-none p-4 pb-3 space-y-3">
                <div className="flex items-start justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-2 min-w-0">
                        {isExternal && (
                            <span className="text-[9px] bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 px-2 py-0.5 rounded-lg font-black tracking-wide uppercase">
                                {dict.tasks?.kanban?.external || "Externo"}
                            </span>
                        )}
                        {computedPriority === "high" && (
                            <span className="text-[9px] bg-[var(--priority-high-bg)] text-[var(--priority-high-text)] border border-[var(--priority-high-border)] px-2 py-0.5 rounded-lg font-black tracking-wide uppercase">
                                {dict.tasks?.priority_high || "Alta"}
                            </span>
                        )}
                        {computedPriority === "medium" && (
                            <span className="text-[9px] bg-[var(--priority-medium-bg)] text-[var(--priority-medium-text)] border border-[var(--priority-medium-border)] px-2 py-0.5 rounded-lg font-black tracking-wide uppercase">
                                {dict.tasks?.priority_medium || "Media"}
                            </span>
                        )}
                        {computedPriority === "low" && (
                            <span className="text-[9px] bg-[var(--priority-low-bg)] text-[var(--priority-low-text)] border border-[var(--priority-low-border)] px-2 py-0.5 rounded-lg font-black tracking-wide uppercase">
                                {dict.tasks?.priority_low || "Baja"}
                            </span>
                        )}
                    </div>
                    <span className="p-1 text-[var(--text-muted)]" aria-hidden="true">
                        <MoreHorizontal className="w-4 h-4" />
                    </span>
                </div>

                <div className="space-y-1">
                    <h4 className={`text-left text-sm font-bold leading-snug text-[var(--text-main)] transition-colors group-hover:text-accent ${
                        isCompleted ? "line-through text-[var(--text-muted)]" : ""
                    }`}>
                        {displayTitle}
                    </h4>
                    {checklist.length > 0 ? (
                        <div className="space-y-1.5 mt-2 relative pl-4 border-l border-neutral-300 dark:border-neutral-700/60 ml-1.5">
                            {checklist.map((item) => (
                                <div key={`${item.text}-${item.checked}-${item.assignedUserId || "all"}`} className="flex items-center justify-between gap-2 text-2xs">
                                    <div className="flex items-center gap-2 relative">
                                        <div className={`absolute left-[-21px] w-2 h-2 rounded-full border ${
                                            item.checked
                                                ? "bg-accent border-accent"
                                                : "bg-[var(--bg-card)] border-neutral-300 dark:border-neutral-700"
                                        }`} />
                                        <span className={`font-semibold ${item.checked ? "line-through text-[var(--text-muted)]" : "text-[var(--text-main)]"}`}>
                                            {item.text}
                                        </span>
                                    </div>
                                    {item.assignedUserId && (
                                        <span
                                            className="text-[9px] bg-accent/10 border border-accent/20 px-1.5 py-0.5 rounded-md text-accent font-black uppercase tracking-wide"
                                            title={item.assignedUserName}
                                        >
                                            {item.assignedUserName ? item.assignedUserName.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2) : getUserInitials(item.assignedUserId).initials}
                                        </span>
                                    )}
                                </div>
                            ))}
                        </div>
                    ) : (
                        localizedDescription && (
                            <p className="text-xs text-[var(--text-muted)] font-medium leading-relaxed line-clamp-2">
                                {cleanChecklistDescription(localizedDescription)}
                            </p>
                        )
                    )}
                </div>
            </div>

            <div className="relative z-10 pointer-events-none border-t border-[var(--border-soft)] px-4 py-3 space-y-3">
                <div className="flex items-center justify-between gap-3 text-xs text-[var(--text-muted)]">
                    <span className={`flex items-center gap-1.5 font-bold ${statusTone.icon}`}>
                        <StatusIcon className="w-3.5 h-3.5" />
                        {statusTone.label}
                    </span>
                </div>
                <TaskProgressBar
                    completed={progress.completed}
                    total={progress.total}
                    barClassName={statusTone.bar}
                />
            </div>

            {workSummary && workSummary.total_seconds > 0 && (
                <div className="relative z-10 pointer-events-none px-4 pb-2 space-y-1.5">
                    {/* Total time badge */}
                    <div className="flex items-center gap-1.5 text-2xs font-bold text-[var(--text-muted)]">
                        <Timer className="w-3.5 h-3.5 text-accent" />
                        <span>{dict.tasks?.work_time_label || "Work time"}:</span>
                        <span className="text-[var(--text-main)] font-black">
                            {formatHoursShort(workSummary.total_seconds)}
                        </span>
                        {workSummary.active_workers > 0 && (
                            <span className="text-accent animate-pulse ml-1">
                                · {workSummary.active_workers} {dict.tasks?.active_label || "active"}
                            </span>
                        )}
                    </div>
                    {/* Individual worker breakdown */}
                    <div className="flex flex-wrap gap-1.5">
                        {workSummary.workers.map((w) => {
                            const loc = workSummary.start_locations?.find(l => l.user_id === w.user_id);
                            const mapUrl = loc ? `https://www.google.com/maps?q=${loc.latitude},${loc.longitude}` : null;
                            const badge = (
                                <span
                                    key={w.user_id}
                                    title={loc ? `${w.user_name} ±${Math.round(loc.accuracy_meters ?? 0)} m` : w.user_name}
                                    className="text-[9px] font-bold bg-[var(--bg-tertiary)] border border-[var(--border-soft)] px-2 py-0.5 rounded-lg text-[var(--text-muted)] flex items-center gap-1"
                                >
                                    {w.user_name}
                                    <span className="text-[var(--text-main)] font-black">
                                        {formatHoursShort(w.total_seconds)}
                                    </span>
                                    {w.is_active && (
                                        <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
                                    )}
                                </span>
                            );
                            return mapUrl ? (
                                <a
                                    key={w.user_id}
                                    href={mapUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="pointer-events-auto hover:opacity-80 transition-opacity"
                                >
                                    {badge}
                                </a>
                            ) : (
                                <span
                                    key={w.user_id}
                                    className="hover:border-accent transition-colors"
                                >
                                    {badge}
                                </span>
                            );
                        })}
                    </div>
                </div>
            )}

            <div className="relative z-10 pointer-events-none px-4 pb-4 pt-1 flex items-center justify-between gap-3">
                <div className="flex items-center min-w-0">
                    <div
                        className={`w-7 h-7 rounded-full ${assignee.backgroundClass} flex items-center justify-center text-[10px] font-black text-white shrink-0 ring-2 ring-white/70`}
                        title={assignee.name}
                    >
                        {assignee.initials}
                    </div>
                    <span className="ml-2 text-2xs text-[var(--text-muted)] font-semibold truncate">
                        {assignee.label}
                    </span>
                </div>

                <div className="flex items-center gap-3 text-[var(--text-muted)] shrink-0">
                    <span className="flex items-center gap-1 text-2xs font-semibold">
                        <FileText className="w-3.5 h-3.5" />
                        {task.is_invoiced ? 1 : 0}
                    </span>
                <span className="flex items-center gap-1 text-2xs font-semibold">
                    <MessageCircle className="w-3.5 h-3.5" />
                    {task.notes || task.description ? 1 : 0}
                </span>
            </div>

            <div className="relative z-10 pointer-events-none px-4 pb-4 -mt-2 flex flex-wrap gap-2 text-2xs font-semibold text-[var(--text-muted)]">
                <span className="bg-[var(--bg-tertiary)] px-2.5 py-1 rounded-lg border border-[var(--border-soft)] flex items-center gap-1.5">
                    <UserRound className="w-3 h-3 text-accent" />
                    {task.quantity ? `${task.quantity} ${task.unit}` : task.unit}
                </span>
                {task.price !== null && (
                    <span className="text-[var(--text-main)] bg-[var(--bg-tertiary)] px-2.5 py-1 border border-[var(--border-soft)] rounded-lg">
                        {task.price} €
                    </span>
                )}
                {task.is_invoiced ? (
                    <span className="flex items-center gap-1 bg-accent/10 text-accent border border-accent/20 px-2.5 py-1 rounded-lg">
                        <Lock className="w-2.5 h-2.5" />
                        {dict.profile?.tables?.invoiced || "Facturado"}
                    </span>
                ) : null}
            </div>
            </div>
        </article>
    );
}
