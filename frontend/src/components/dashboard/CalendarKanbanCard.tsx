"use client";

import React, { useMemo } from "react";
import { CalendarDays, Loader2, Lock, MapPin, Timer } from "lucide-react";
import { TaskItem, TaskWorkDetailedSummary } from "@/types/user";
import { useDictionary } from "@/lib/dictionary-context";
import { formatHoursShort } from "@/lib/format-hours";
import { localizeTaskTitle } from "@/lib/task-display";
import { getTaskChecklistProgress } from "@/lib/task-checklist-completion";
import { isTaskDateOnlyValue, toTaskPlanningDateInput } from "@/domain/tasks/task-schedule";
import { TaskProgressBar } from "@/components/tasks/TaskProgressBar";
import { getCalendarKanbanAssignee } from "./calendar-kanban-card-utils";

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
    task, updating, getUserInitials, getUserFullName, getLocationName,
    onDragStart, onClick, isExternal = false, canDrag = true, workSummary,
}: CalendarKanbanCardProps) {
    const { dict, locale } = useDictionary();
    const assignee = getCalendarKanbanAssignee(task, getUserFullName, getUserInitials, dict.tasks.kanban.accepted_by);
    const locationName = getLocationName(task.location_id);
    const completed = task.status === "completed";
    const checklist = getTaskChecklistProgress(task);
    const progress = checklist.total > 0 ? checklist : { completed: completed ? 1 : 0, total: 1 };
    const priority = task.priority || "medium";
    const priorityTone = priority === "high"
        ? "bg-[var(--priority-high-bg)] text-[var(--priority-high-text)] border-[var(--priority-high-border)]"
        : priority === "low"
            ? "bg-[var(--priority-low-bg)] text-[var(--priority-low-text)] border-[var(--priority-low-border)]"
            : "bg-[var(--priority-medium-bg)] text-[var(--priority-medium-text)] border-[var(--priority-medium-border)]";
    const priorityLabel = priority === "high" ? dict.tasks.priority_high : priority === "low" ? dict.tasks.priority_low : dict.tasks.priority_medium;
    const planningValue = task.scheduled_start_at || task.due_at;
    const plannedLabel = useMemo(() => {
        if (!planningValue) return null;
        const day = isTaskDateOnlyValue(planningValue) ? toTaskPlanningDateInput(planningValue) : null;
        const date = new Date(day ? `${day}T12:00:00.000Z` : planningValue);
        return Number.isNaN(date.getTime()) ? null : date.toLocaleString(locale === "es" ? "es-ES" : "en-GB", { day: "numeric", month: "short", ...(!day ? { hour: "2-digit" as const, minute: "2-digit" as const } : {}), timeZone: "UTC" });
    }, [locale, planningValue]);

    return (
        <article
            draggable={canDrag && !task.is_invoiced && !updating}
            onDragStart={(e) => onDragStart(e, task.id)}
            className={`group relative overflow-hidden rounded-2xl border border-[var(--border-soft)] bg-[var(--bg-card)] shadow-sm ui-motion hover:border-accent/40 ${canDrag && !task.is_invoiced ? "cursor-grab active:cursor-grabbing" : "cursor-pointer"}`}
        >
            <button
                type="button"
                onClick={() => onClick(task)}
                aria-label={`Abrir tarea: ${task.title}`}
                className="absolute inset-0 z-0 rounded-2xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            />
            {updating && <div className="absolute inset-0 z-30 flex items-center justify-center bg-[var(--bg-card)]/70 backdrop-blur-xs"><Loader2 className="size-4 animate-spin text-accent" /></div>}
            <div className="pointer-events-none relative z-10 space-y-2.5 p-3">
                <div className="flex items-start justify-between gap-2">
                    <h4 className={`min-w-0 break-words text-sm font-bold leading-snug text-[var(--text-main)] group-hover:text-accent ${completed ? "text-[var(--text-muted)]" : ""}`}>
                        {localizeTaskTitle(task.title)}
                    </h4>
                    <span className={`shrink-0 rounded-md border px-1.5 py-0.5 text-[9px] font-bold uppercase ${priorityTone}`}>{priorityLabel}</span>
                </div>
                <div className="space-y-1 text-xs text-[var(--text-muted)]">
                    <p className="flex items-start gap-1.5"><MapPin className="mt-0.5 size-3 shrink-0" aria-hidden="true" /><span className="min-w-0 break-words">{locationName}</span></p>
                    {plannedLabel && <p className="flex items-center gap-1.5"><CalendarDays className="size-3 shrink-0" aria-hidden="true" />{plannedLabel}</p>}
                </div>
                <TaskProgressBar completed={progress.completed} total={progress.total} />
                <div className="flex min-w-0 items-center gap-2 border-t border-[var(--border-soft)] pt-2">
                    <span aria-hidden="true" className={`flex size-6 shrink-0 items-center justify-center rounded-full text-[9px] font-bold text-white ${assignee.backgroundClass}`}>{assignee.initials}</span>
                    <span title={assignee.label} className="min-w-0 flex-1 truncate text-xs font-medium text-[var(--text-muted)]">{assignee.label}</span>
                    {workSummary && workSummary.total_seconds > 0 && <span className="flex shrink-0 items-center gap-1 text-[10px] font-semibold text-[var(--text-muted)]"><Timer className="size-3" aria-hidden="true" />{formatHoursShort(workSummary.total_seconds)}</span>}
                    {task.is_invoiced && <Lock className="size-3.5 shrink-0 text-accent" aria-label={dict.profile.tables.invoiced} />}
                    {isExternal && <span className="text-[9px] font-bold text-accent">{dict.tasks.kanban.external}</span>}
                </div>
            </div>
        </article>
    );
}
