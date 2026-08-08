"use client";

import React from "react";
import { Building2, Check, ChevronRight, Lock, MapPin, UserRound } from "lucide-react";
import { TaskItem } from "@/services/task.service";
import { Location } from "@/services/location.service";
import { User } from "@/types/user";
import type { Dictionary } from "@/lib/dictionary-context";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
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

const badgeQuiet =
    "shrink-0 px-1.5 py-0 text-[9px] font-semibold uppercase tracking-wide";

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
    return (
        <button
            type="button"
            aria-label={label}
            aria-pressed={isCompleted}
            disabled={disabled}
            className="group/check relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-none bg-transparent p-0 cursor-pointer disabled:cursor-not-allowed disabled:opacity-45"
            onClick={onToggle}
        >
            {isCompleted ? (
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-accent/15 text-accent ring-1 ring-accent/30 transition-transform duration-150 group-hover/check:scale-[1.04]">
                    <Check className="h-3 w-3 stroke-[2.75px]" />
                </span>
            ) : isProgress || isReview ? (
                <span className="relative flex h-5 w-5 items-center justify-center rounded-full bg-accent/[0.08] ring-1.5 ring-accent/45 transition-colors group-hover/check:bg-accent/15">
                    <span className="absolute inset-[3px] rounded-full border-[1.5px] border-accent/30 border-t-accent border-r-accent" />
                </span>
            ) : (
                <span className="h-5 w-5 rounded-full bg-transparent ring-[1.5px] ring-[color-mix(in_srgb,var(--text-muted)_28%,transparent)] transition-colors group-hover/check:bg-accent/[0.06] group-hover/check:ring-accent/45" />
            )}
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

    const statusBadgeClass = isCompleted
        ? "border-accent/20 bg-accent/10 text-accent"
        : isProgress || isReview
          ? "border-accent/20 bg-accent/10 text-accent"
          : "border-[var(--border-soft)] bg-[var(--bg-secondary)] text-[var(--text-muted)]";

    return (
        <article className={cn("h-full min-w-0", dimmed && "opacity-70")}>
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
                className={cn(
                    "billing-block group flex h-full min-h-[72px] w-full cursor-pointer items-center gap-2 rounded-2xl border border-[var(--border-soft)] px-3 py-2.5 text-left transition-[border-color,box-shadow] duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/35",
                    isExternal
                        ? "hover:border-accent/40"
                        : "hover:border-accent/30 hover:shadow-[0_8px_20px_rgba(52,74,94,0.08)]",
                )}
            >
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
                            className={cn(
                                "min-w-0 truncate text-[13px] font-bold leading-none tracking-tight",
                                isCompleted
                                    ? "text-[var(--text-muted)] line-through decoration-[var(--text-muted)]/50"
                                    : "text-[var(--text-main)] group-hover:text-accent",
                            )}
                        >
                            {task.title}
                        </h3>
                        <div className="flex min-w-0 shrink items-center gap-1 overflow-hidden">
                            {task.priority === "high" && (
                                <Badge
                                    variant="secondary"
                                    className={cn(
                                        badgeQuiet,
                                        "border-[var(--priority-high-border)] bg-[var(--priority-high-bg)] text-[var(--priority-high-text)]",
                                    )}
                                >
                                    {dict.tasks?.priority_high || "High"}
                                </Badge>
                            )}
                            {task.priority === "medium" && (
                                <Badge
                                    variant="secondary"
                                    className={cn(
                                        badgeQuiet,
                                        "border-[var(--priority-medium-border)] bg-[var(--priority-medium-bg)] text-[var(--priority-medium-text)]",
                                    )}
                                >
                                    {dict.tasks?.priority_medium || "Medium"}
                                </Badge>
                            )}
                            {task.priority === "low" && (
                                <Badge
                                    variant="secondary"
                                    className={cn(
                                        badgeQuiet,
                                        "border-[var(--priority-low-border)] bg-[var(--priority-low-bg)] text-[var(--priority-low-text)]",
                                    )}
                                >
                                    {dict.tasks?.priority_low || "Low"}
                                </Badge>
                            )}
                            <Badge
                                variant="secondary"
                                className={cn(badgeQuiet, statusBadgeClass)}
                            >
                                {statusLabel}
                            </Badge>
                            {isExternal && (
                                <Badge
                                    variant="default"
                                    className={cn(badgeQuiet, "inline-flex items-center gap-1")}
                                >
                                    <Building2 className="h-2.5 w-2.5" />
                                    Externo
                                </Badge>
                            )}
                            {task.is_invoiced && (
                                <Badge
                                    variant="secondary"
                                    className={cn(
                                        badgeQuiet,
                                        "inline-flex items-center gap-1 border-accent/20 bg-accent/10 text-accent",
                                    )}
                                >
                                    <Lock className="h-2.5 w-2.5" />
                                    {dict.profile?.tables?.invoiced || "Facturado"}
                                </Badge>
                            )}
                        </div>
                    </div>

                    <div className="flex min-w-0 items-center gap-1.5 overflow-hidden text-[11px] leading-none text-[color-mix(in_srgb,var(--text-muted)_55%,var(--text-main))]">
                        <span className="inline-flex min-w-0 max-w-[42%] items-center gap-1 truncate">
                            <MapPin className="h-3 w-3 shrink-0 text-accent" />
                            <span className="truncate">{getLocationName(task.location_id)}</span>
                        </span>
                        {isAdminOrManager && (
                            <>
                                <span aria-hidden="true" className="text-[var(--border-color)]">·</span>
                                <span className="inline-flex min-w-0 max-w-[28%] items-center gap-1 truncate">
                                    <UserRound className="h-3 w-3 shrink-0 opacity-80" />
                                    <span className="truncate">{getAssigneeName(task.user_id)}</span>
                                </span>
                            </>
                        )}
                        {checklist.length > 0 && (
                            <>
                                <span aria-hidden="true" className="text-[var(--border-color)]">·</span>
                                <span className="shrink-0 font-semibold tabular-nums">
                                    {checkedCount}/{checklist.length}
                                </span>
                            </>
                        )}
                        {task.price !== null && (
                            <>
                                <span aria-hidden="true" className="text-[var(--border-color)]">·</span>
                                <span className="shrink-0 font-semibold tabular-nums text-accent">
                                    {task.price} €{task.quantity ? ` × ${task.quantity}` : ""}
                                </span>
                            </>
                        )}
                    </div>
                </div>

                <ChevronRight className="h-3.5 w-3.5 shrink-0 text-[color-mix(in_srgb,var(--text-muted)_40%,var(--text-main))] transition group-hover:translate-x-0.5 group-hover:text-accent" />
            </div>
        </article>
    );
}
