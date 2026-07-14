"use client";

import React from "react";
import { Building2, Check, ChevronRight, Lock, MapPin, UserRound } from "lucide-react";
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

function TaskStatusCheckbox({
    isCompleted,
    isProgress,
    isReview,
    disabled,
    label,
    onToggle,
}: {
    isCompleted: boolean;
    isProgress: boolean;
    isReview: boolean;
    disabled?: boolean;
    label: string;
    onToggle: (event: React.MouseEvent) => void;
}) {
    const active = isCompleted || isProgress || isReview;

    return (
        <button
            type="button"
            aria-label={label}
            aria-pressed={isCompleted}
            disabled={disabled}
            className="group/check relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-none bg-transparent p-0 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
            onClick={onToggle}
        >
            <span
                className={`flex h-[22px] w-[22px] items-center justify-center rounded-full border-[1.5px] shadow-[inset_0_1px_0_rgba(255,255,255,0.55)] transition-all duration-200 ${
                    isCompleted
                        ? "border-accent bg-accent text-white shadow-[0_1px_2px_rgba(37,99,235,0.35)]"
                        : isProgress || isReview
                          ? "border-accent bg-accent/15 text-accent"
                          : "border-[color-mix(in_srgb,var(--text-muted)_45%,transparent)] bg-[color-mix(in_srgb,var(--bg-card)_88%,white)] group-hover/check:border-accent/55 group-hover/check:bg-accent/5"
                }`}
            >
                {isCompleted ? (
                    <Check className="h-3 w-3 stroke-[3px]" />
                ) : active ? (
                    <span className="h-1.5 w-1.5 rounded-full bg-accent" />
                ) : null}
            </span>
        </button>
    );
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
        <article className={`h-full min-w-0 ${dimmed ? "opacity-70" : ""}`}>
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
                className={`group flex h-full min-h-[72px] w-full items-center gap-2 rounded-2xl border px-3 py-2.5 text-left shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 cursor-pointer ${
                    isExternal
                        ? "border-indigo-400/35 bg-[color-mix(in_srgb,rgb(99_102_241)_8%,var(--bg-card))] hover:border-indigo-400/55 hover:bg-[color-mix(in_srgb,rgb(99_102_241)_12%,var(--bg-card))]"
                        : "border-[var(--border-soft)] bg-[var(--bg-card)] hover:border-accent/35 hover:bg-[var(--bg-secondary)]/60"
                }`}
            >
                <span
                    aria-hidden="true"
                    className={`h-10 w-1 shrink-0 rounded-full ${
                        isExternal ? "bg-indigo-500/80" : "bg-accent/35"
                    }`}
                />

                <TaskStatusCheckbox
                    isCompleted={isCompleted}
                    isProgress={isProgress}
                    isReview={isReview}
                    disabled={Boolean(task.is_invoiced)}
                    label={statusLabel}
                    onToggle={(event) => {
                        event.stopPropagation();
                        handleToggleStatus(task, event);
                    }}
                />

                <div className="grid min-w-0 flex-1 gap-1">
                    <div className="flex min-w-0 items-center gap-1.5 overflow-hidden">
                        <h3
                            className={`min-w-0 truncate text-[13px] font-bold leading-none tracking-tight ${
                                isCompleted
                                    ? "text-[var(--text-muted)] line-through decoration-[var(--text-muted)]/70"
                                    : "text-[var(--text-main)] group-hover:text-accent"
                            }`}
                        >
                            {task.title}
                        </h3>
                        <div className="flex min-w-0 shrink items-center gap-1 overflow-hidden">
                            {task.priority === "high" && (
                                <span className="shrink-0 rounded-full border border-[var(--priority-high-border)] bg-[var(--priority-high-bg)] px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wide text-[var(--priority-high-text)]">
                                    {dict.tasks?.priority_high || "High"}
                                </span>
                            )}
                            {task.priority === "medium" && (
                                <span className="shrink-0 rounded-full border border-[var(--priority-medium-border)] bg-[var(--priority-medium-bg)] px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wide text-[var(--priority-medium-text)]">
                                    {dict.tasks?.priority_medium || "Medium"}
                                </span>
                            )}
                            {task.priority === "low" && (
                                <span className="shrink-0 rounded-full border border-[var(--priority-low-border)] bg-[var(--priority-low-bg)] px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wide text-[var(--priority-low-text)]">
                                    {dict.tasks?.priority_low || "Low"}
                                </span>
                            )}
                            <span className={`shrink-0 rounded-full border px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wide ${statusChipClass}`}>
                                {statusLabel}
                            </span>
                            {isExternal && (
                                <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-indigo-500/30 bg-indigo-500/15 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wide text-indigo-700 dark:text-indigo-300">
                                    <Building2 className="h-2.5 w-2.5" />
                                    Externo
                                </span>
                            )}
                            {task.is_invoiced && (
                                <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-accent/25 bg-accent/10 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wide text-accent">
                                    <Lock className="h-2.5 w-2.5" />
                                    {dict.profile?.tables?.invoiced || "Facturado"}
                                </span>
                            )}
                        </div>
                    </div>

                    <div className="flex min-w-0 items-center gap-1.5 overflow-hidden text-[11px] leading-none text-[var(--text-muted)]">
                        <span className="inline-flex min-w-0 max-w-[42%] items-center gap-1 truncate">
                            <MapPin className={`h-3 w-3 shrink-0 ${isExternal ? "text-indigo-500" : "text-accent"}`} />
                            <span className="truncate">{getLocationName(task.location_id)}</span>
                        </span>
                        {isAdminOrManager && (
                            <>
                                <span aria-hidden="true" className="text-[var(--border-soft)]">·</span>
                                <span className="inline-flex min-w-0 max-w-[28%] items-center gap-1 truncate">
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
