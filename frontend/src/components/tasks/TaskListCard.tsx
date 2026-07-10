"use client";

import React from "react";
import { Check, Lock } from "lucide-react";
import { cleanChecklistDescription } from "@/lib/format";
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
}

function getAssigneeInitials(getAssigneeName: (userId: number | null) => string, userId: number | null) {
    const name = getAssigneeName(userId);
    if (!name || name.startsWith("ID:")) return "?";
    const parts = name.split(" ");
    if (parts.length >= 2) {
        return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
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
}: TaskListCardProps) {
    const isCompleted = task.status === "completed";
    const isProgress = task.status === "progress" || task.status === "in_progress";
    const isReview = task.status === "review" || task.status === "in_review";
    const checklist = parseChecklist(task.description);

    const loc = locations.find(l => l.id === task.location_id);
    const ownerCompanyId = loc?.owner_company_id ?? loc?.managing_company_id;
    const isExternal = Boolean(ownerCompanyId && ownerCompanyId !== currentUser?.company_id);

    const bgBorderClass = "bg-[var(--bg-card)] border border-[var(--border-soft)]";

    const borderTopClass = task.is_invoiced
        ? "border-t-[3px] border-t-purple-500"
        : isCompleted
        ? "border-t-[3px] border-t-accent"
        : isProgress
        ? "border-t-[3px] border-t-accent"
        : isReview
        ? "border-t-[3px] border-t-zinc-400 dark:border-t-zinc-600"
        : "border-t-[3px] border-t-zinc-300 dark:border-t-zinc-700";

    return (
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
            className={`${bgBorderClass} ${borderTopClass} rounded-2xl p-5 shadow-[0_4px_20px_rgba(0,0,0,0.03)] hover:shadow-[0_10px_25px_rgba(0,0,0,0.08)] transition-all duration-200 cursor-pointer flex flex-col justify-between min-h-[180px] group ${
                task.is_invoiced ? "opacity-90" : ""
            }`}
        >
            <div className="space-y-3 flex-1 flex flex-col justify-between">
                <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1 flex-shrink-0">
                        {isExternal && (
                            <span className="text-[9px] bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 px-2 py-0.5 rounded-lg font-black tracking-wide uppercase">
                                Externo
                            </span>
                        )}
                        {task.priority === "high" && (
                            <span className="text-[9px] bg-[var(--priority-high-bg)] text-[var(--priority-high-text)] border border-[var(--priority-high-border)] px-2 py-0.5 rounded-lg font-black tracking-wide uppercase">
                                {dict.tasks?.priority_high || "High"}
                            </span>
                        )}
                        {task.priority === "medium" && (
                            <span className="text-[9px] bg-[var(--priority-medium-bg)] text-[var(--priority-medium-text)] border border-[var(--priority-medium-border)] px-2 py-0.5 rounded-lg font-black tracking-wide uppercase">
                                {dict.tasks?.priority_medium || "Medium"}
                            </span>
                        )}
                        {task.priority === "low" && (
                            <span className="text-[9px] bg-[var(--priority-low-bg)] text-[var(--priority-low-text)] border border-[var(--priority-low-border)] px-2 py-0.5 rounded-lg font-black tracking-wide uppercase">
                                {dict.tasks?.priority_low || "Low"}
                            </span>
                        )}

                        {isCompleted ? (
                            <span className="text-3xs bg-accent/10 dark:bg-accent/10 text-accent dark:text-accent border border-accent dark:border-accent/40 px-2.5 py-0.5 rounded-full font-bold tracking-wide">
                                {dict.profile?.tables?.status_completed || "Completed"}
                            </span>
                        ) : isProgress || isReview ? (
                            <span className="text-3xs bg-accent/10 dark:bg-accent/10 text-accent dark:text-accent border border-accent dark:border-accent/40 px-2.5 py-0.5 rounded-full font-bold tracking-wide">
                                {dict.profile?.tables?.status_in_progress || "In Progress"}
                            </span>
                        ) : (
                            <span className="text-3xs bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700 px-2.5 py-0.5 rounded-full font-bold tracking-wide">
                                {dict.profile?.tables?.status_pending || "Pending"}
                            </span>
                        )}

                        {task.is_invoiced ? (
                            <span className="flex items-center gap-1 bg-accent/10 text-accent border border-accent/20 px-2 py-0.5 rounded-md text-[9px] font-bold">
                                <Lock className="w-2.5 h-2.5" />
                                {dict.profile?.tables?.invoiced || "Facturado"}
                            </span>
                        ) : null}
                    </div>
                </div>

                <div className="flex items-start gap-3 flex-1 pt-1">
                    <button
                        type="button"
                        aria-label={
                            isCompleted
                                ? dict.profile?.tables?.status_completed || "Completed"
                                : dict.profile?.tables?.status_pending || "Pending"
                        }
                        className="mt-0.5 shrink-0 bg-transparent border-none p-0 cursor-pointer"
                        onClick={(e) => {
                            e.stopPropagation();
                            handleToggleStatus(task, e);
                        }}
                    >
                        <div
                            className={`w-5 h-5 rounded-md border flex items-center justify-center transition-all ${
                                isCompleted
                                    ? "bg-accent border-accent text-white"
                                    : isProgress
                                    ? "bg-accent border-accent text-white"
                                    : "border-[var(--border-color)] bg-[var(--bg-primary)] hover:border-accent/40"
                            } ${task.is_invoiced ? "opacity-60" : ""}`}
                        >
                            {isCompleted ? (
                                <Check className="w-3.5 h-3.5 stroke-[3px]" />
                            ) : isProgress || isReview ? (
                                <span className="w-1.5 h-1.5 rounded-full bg-white" />
                            ) : null}
                        </div>
                    </button>
                    <div className="min-w-0 w-full">
                        <h3 className={`text-sm font-bold text-[var(--text-main)] group-hover:text-accent transition-colors leading-snug ${isCompleted ? "line-through text-[var(--text-muted)]" : ""}`}>
                            {task.title}
                        </h3>
                        {checklist.length > 0 ? (
                            <div className="space-y-1.5 mt-2 relative pl-4 border-l border-neutral-300 dark:border-neutral-600/70 ml-1.5">
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
                                                className="text-[9px] bg-accent/10 border border-accent/20 px-1.5 py-0.5 rounded-md text-accent font-black uppercase tracking-wide shrink-0"
                                                title={item.assignedUserName}
                                            >
                                                {item.assignedUserName ? item.assignedUserName.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2) : `ID: ${item.assignedUserId}`}
                                            </span>
                                        )}
                                    </div>
                                ))}
                            </div>
                        ) : (
                            task.description && (
                                <p className={`text-xs text-[var(--text-muted)] mt-1.5 line-clamp-2 leading-relaxed ${isCompleted ? "line-through" : ""}`}>
                                    {cleanChecklistDescription(task.description)}
                                </p>
                            )
                        )}
                    </div>
                </div>
            </div>

            <div className="mt-4 pt-3 border-t border-[var(--border-soft)] flex items-center justify-between gap-2">
                <div className="flex items-center min-w-0">
                    {isAdminOrManager && (
                        <div className="flex items-center gap-1.5 min-w-0">
                            <span className="w-5 h-5 rounded-full bg-accent/10 text-accent flex items-center justify-center font-black text-[9px] border border-accent/20 shrink-0">
                                {getAssigneeInitials(getAssigneeName, task.user_id)}
                            </span>
                            <span className="text-[10px] font-bold text-[var(--text-muted)] truncate">
                                {getAssigneeName(task.user_id)}
                            </span>
                        </div>
                    )}
                </div>

                <div className="flex items-center gap-2 shrink-0">
                    {checklist.length > 0 && (
                        <span className="bg-accent/10 text-accent border border-accent/20 px-2.5 py-1 rounded-lg font-bold text-xs shrink-0">
                            {checklist.filter(c => c.checked).length}/{checklist.length} Tasks
                        </span>
                    )}
                    {task.price !== null && (
                        <span className="bg-accent/5 text-accent border border-accent/20 px-2.5 py-1 rounded-lg font-bold text-xs shrink-0">
                            {task.price} € {task.quantity ? `x ${task.quantity}` : ""}
                        </span>
                    )}
                </div>
            </div>
        </div>
    );
}
