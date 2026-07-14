"use client";

import React from "react";
import { Check, ChevronRight, Lock, MapPin, UserRound } from "lucide-react";
import { TaskItem } from "@/services/task.service";
import { Location } from "@/services/location.service";
import { User } from "@/types/user";
import type { Dictionary } from "@/lib/dictionary-context";
import { parseChecklist } from "./tasksListUtils";

interface TaskListCardProps {
    dict: Dictionary;
    task: TaskItem;
    locations: Location[];
    currentUser: User | null;
    isAdminOrManager: boolean;
    handleOpenDetail: (task: TaskItem) => void;
    handleToggleStatus: (task: TaskItem, e: React.MouseEvent) => void;
    getAssigneeName: (userId: number | null) => string;
    getLocationName: (locId: number) => string;
    dimmed?: boolean;
}

export function TaskListCard({
    dict,
    task,
    locations,
    currentUser,
    isAdminOrManager,
    handleOpenDetail,
    handleToggleStatus,
    getAssigneeName,
    getLocationName,
    dimmed = false,
}: TaskListCardProps) {
    const isCompleted = task.status === "completed";
    const isProgress = task.status === "progress" || task.status === "in_progress";
    const isReview = task.status === "review" || task.status === "in_review";
    const checklist = parseChecklist(task.description);

    const loc = locations.find(l => l.id === task.location_id);
    const ownerCompanyId = loc?.owner_company_id ?? loc?.managing_company_id;
    const isExternal = Boolean(ownerCompanyId && ownerCompanyId !== currentUser?.company_id);
    const checkedCount = checklist.filter(item => item.checked).length;

    const statusLabel = isCompleted
        ? (dict.profile?.tables?.status_completed || "Completed")
        : isReview
          ? (dict.tasks?.filter_in_review || "In review")
          : isProgress
            ? (dict.profile?.tables?.status_in_progress || "In Progress")
            : (dict.profile?.tables?.status_pending || "Pending");

    const statusChipClass = isCompleted || isProgress || isReview
        ? "border-accent/20 bg-accent/10 text-accent"
        : "border-[var(--border-soft)] bg-[var(--bg-secondary)] text-[var(--text-muted)]";

    return (
        <article className={`min-w-0 ${dimmed ? "opacity-60" : ""}`}>
            <div
                role="button"
                tabIndex={0}
                aria-label={task.title}
                onClick={() => handleOpenDetail(task)}
                onKeyDown={(event) => {
                    if (event.target !== event.currentTarget) return;
                    if (event.key === "Enter" || event.key === " ") {
                        if (event.key === " ") event.preventDefault();
                        handleOpenDetail(task);
                    }
                }}
                className="group flex w-full items-center gap-2.5 rounded-xl border border-[var(--border-soft)] bg-[var(--bg-card)] px-3 py-2.5 text-left transition hover:border-accent/35 hover:bg-[var(--bg-secondary)]/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 cursor-pointer"
            >
                <button
                    type="button"
                    aria-label={statusLabel}
                    className="shrink-0 border-none bg-transparent p-0 cursor-pointer"
                    onClick={(event) => {
                        event.stopPropagation();
                        handleToggleStatus(task, event);
                    }}
                >
                    <span
                        className={`flex h-5 w-5 items-center justify-center rounded-md border transition-all ${
                            isCompleted
                                ? "border-accent bg-accent text-white"
                                : isProgress || isReview
                                  ? "border-accent bg-accent text-white"
                                  : "border-[var(--border-color)] bg-[var(--bg-primary)] hover:border-accent/40"
                        } ${task.is_invoiced ? "opacity-60" : ""}`}
                    >
                        {isCompleted ? (
                            <Check className="h-3.5 w-3.5 stroke-[3px]" />
                        ) : isProgress || isReview ? (
                            <span className="h-1.5 w-1.5 rounded-full bg-white" />
                        ) : null}
                    </span>
                </button>

                <div className="min-w-0 flex-1">
                    <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                        <h3
                            className={`truncate text-[13px] font-bold leading-snug transition-colors group-hover:text-accent ${
                                isCompleted
                                    ? "text-[var(--text-muted)] line-through"
                                    : "text-[var(--text-main)]"
                            }`}
                        >
                            {task.title}
                        </h3>
                        {task.priority === "high" && (
                            <span className="shrink-0 rounded-lg border border-[var(--priority-high-border)] bg-[var(--priority-high-bg)] px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wide text-[var(--priority-high-text)]">
                                {dict.tasks?.priority_high || "High"}
                            </span>
                        )}
                        {task.priority === "medium" && (
                            <span className="shrink-0 rounded-lg border border-[var(--priority-medium-border)] bg-[var(--priority-medium-bg)] px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wide text-[var(--priority-medium-text)]">
                                {dict.tasks?.priority_medium || "Medium"}
                            </span>
                        )}
                        {task.priority === "low" && (
                            <span className="shrink-0 rounded-lg border border-[var(--priority-low-border)] bg-[var(--priority-low-bg)] px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wide text-[var(--priority-low-text)]">
                                {dict.tasks?.priority_low || "Low"}
                            </span>
                        )}
                        <span className={`shrink-0 rounded-lg border px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wide ${statusChipClass}`}>
                            {statusLabel}
                        </span>
                        {isExternal && (
                            <span className="shrink-0 rounded-lg border border-indigo-500/20 bg-indigo-500/10 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wide text-indigo-600 dark:text-indigo-400">
                                Externo
                            </span>
                        )}
                        {task.is_invoiced && (
                            <span className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-accent/20 bg-accent/10 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wide text-accent">
                                <Lock className="h-2.5 w-2.5" />
                                {dict.profile?.tables?.invoiced || "Facturado"}
                            </span>
                        )}
                    </div>

                    <div className="mt-0.5 flex min-w-0 items-center gap-1.5 text-[11px] text-[var(--text-muted)]">
                        <span className="inline-flex min-w-0 items-center gap-1 truncate">
                            <MapPin className="h-3 w-3 shrink-0 text-accent" />
                            <span className="truncate">{getLocationName(task.location_id)}</span>
                        </span>
                        {isAdminOrManager && (
                            <>
                                <span aria-hidden="true" className="text-[var(--border-soft)]">·</span>
                                <span className="inline-flex min-w-0 items-center gap-1 truncate">
                                    <UserRound className="h-3 w-3 shrink-0" />
                                    <span className="truncate">{getAssigneeName(task.user_id)}</span>
                                </span>
                            </>
                        )}
                        {checklist.length > 0 && (
                            <>
                                <span aria-hidden="true" className="text-[var(--border-soft)]">·</span>
                                <span className="shrink-0 font-semibold tabular-nums">
                                    {checkedCount}/{checklist.length}
                                </span>
                            </>
                        )}
                        {task.price !== null && (
                            <>
                                <span aria-hidden="true" className="text-[var(--border-soft)]">·</span>
                                <span className="shrink-0 font-semibold tabular-nums text-accent">
                                    {task.price} €{task.quantity ? ` × ${task.quantity}` : ""}
                                </span>
                            </>
                        )}
                    </div>
                </div>

                <ChevronRight className="h-3.5 w-3.5 shrink-0 text-[var(--text-muted)] transition group-hover:translate-x-0.5 group-hover:text-accent" />
            </div>
        </article>
    );
}
