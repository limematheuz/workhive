import React from "react";
import { Clock, MapPin, Check, X, Calendar, Flag, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { TaskItem, User, TaskWorkDetailedSummary } from "@/types/user";
import { useDictionary } from "@/lib/dictionary-context";
import { getUserTaskStatus, isTaskAssignedToUser } from "@/lib/format";
import { canManageCompanyTasks } from "@/domain/access/roles";
import { getTaskScheduleDate } from "@/domain/tasks/task-schedule";
import { canStartTaskWork, isTaskWorkInProgress } from "@/domain/tasks/task-status";
import { getTaskChecklistProgress } from "@/lib/task-checklist-completion";
import { isExternalTaskForCompany } from "@/lib/task-display";
import { getOperationalTaskStatus } from "@/lib/operational-task-count";
import { TechTaskCardSupplementaryInfo } from "./TechTaskCardSupplementaryInfo";

interface TechTaskCardProps {
    task: TaskItem;
    locationName: string;
    locationAddress?: string;
    currentUser?: User | null;
    onAccept: (taskId: number) => void;
    onReject: (taskId: number) => void;
    onViewDetails: (task: TaskItem) => void;
    hideLocationName?: boolean;
    workSummary?: TaskWorkDetailedSummary;
}

export function TechTaskCard({
    task,
    locationName,
    locationAddress,
    currentUser,
    onAccept,
    onReject,
    onViewDetails,
    hideLocationName = false,
    workSummary,
}: TechTaskCardProps) {
    const { dict, locale } = useDictionary();
    const canAcceptAssignments = canManageCompanyTasks(currentUser);

    const userStatus = React.useMemo(() => {
        if (!currentUser) return task.status;
        return getUserTaskStatus(task, currentUser.id);
    }, [task, currentUser]);
    const displayStatus = getOperationalTaskStatus(
        task,
        currentUser?.id ?? 0,
        canAcceptAssignments,
    );
    const checklistProgress = getTaskChecklistProgress(task);
    const isExternal = isExternalTaskForCompany(task, currentUser?.company_id);
    const externalSource = task.checkout_reservation?.owner_company_name;

    const isCompleted = displayStatus === "completed";
    const isProgress = isTaskWorkInProgress(displayStatus);
    const isAccepted = displayStatus === "accepted";
    const isRejected = displayStatus === "rejected";
    const isPending = displayStatus === "pending";
    const canStartWork = currentUser
        ? !isCompleted && canStartTaskWork(
            task.status,
            userStatus,
            isTaskAssignedToUser(task, currentUser.id),
        )
        : false;
    const isAwaitingApproval = isPending && !canAcceptAssignments && !canStartWork;

    const planningDate = React.useMemo(
        () => getTaskScheduleDate(task) || new Date(task.created_at),
        [task],
    );

    // Check if task is overdue (due/planning date passed and not completed)
    const isOverdue = React.useMemo(() => {
        if (isCompleted) return false;
        const now = new Date();
        return planningDate.getTime() < now.getTime();
    }, [planningDate, isCompleted]);

    const formattedDate = React.useMemo(() => {
        try {
            return planningDate.toLocaleDateString(locale === "en" ? "en-US" : "es-ES", {
                weekday: "short",
                month: "short",
                day: "numeric",
                timeZone: "UTC",
            });
        } catch {
            return "";
        }
    }, [planningDate, locale]);

    const reservationSummary = React.useMemo(() => {
        const formatTime = (value: string) =>
            new Date(value).toLocaleTimeString(locale === "en" ? "en-US" : "es-ES", {
                hour: "2-digit",
                minute: "2-digit",
                timeZone: "UTC",
            });
        
        const exitLabel = dict.tech?.card_exit || "EXIT";
        const inLabel = dict.tech?.card_in || "IN";
        const guestsLabel = dict.tech?.card_guests || "GUESTS";
        const noNextArrivalLabel = dict.tech?.card_no_next_arrival || "NO NEXT ARRIVAL";
        const cleaningWithoutReservationLabel = dict.tech?.card_cleaning_without_reservation || "CLEANING WITHOUT RESERVATION";

        if (task.checkout_reservation && task.next_reservation) {
            return `${exitLabel} ${formatTime(task.checkout_reservation.check_out_at)} / ${inLabel} ${formatTime(task.next_reservation.check_in_at)} · ${task.next_reservation.guest_count} ${guestsLabel}`;
        }
        if (task.checkout_reservation) {
            return `${exitLabel} ${formatTime(task.checkout_reservation.check_out_at)} · ${noNextArrivalLabel}`;
        }
        if (task.next_reservation) {
            return `${inLabel} ${formatTime(task.next_reservation.check_in_at)} · ${task.next_reservation.guest_count} ${guestsLabel}`;
        }
        return cleaningWithoutReservationLabel;
    }, [locale, dict.tech, task.checkout_reservation, task.next_reservation]);

    // Status translation label
    const statusLabel = React.useMemo(() => {
        if (isOverdue) return dict.tech?.card_overdue || "OVERDUE";
        if (isCompleted) return dict.tech.status_completed;
        if (isProgress) return dict.tech.status_progress;
        if (isAccepted) return dict.tech.status_accepted;
        if (isRejected) return dict.tech.status_rejected;
        return dict.tech?.card_new || "NEW";
    }, [isOverdue, isCompleted, isProgress, isAccepted, isRejected, dict.tech]);

    return (
        <div
            role="button"
            tabIndex={0}
            aria-label={task.title}
            onClick={() => onViewDetails(task)}
            onKeyDown={(event) => {
                if (event.target !== event.currentTarget) return;
                if (event.key === "Enter" || event.key === " ") {
                    if (event.key === " ") event.preventDefault();
                    onViewDetails(task);
                }
            }}
            className={cn(
                "surface-glass-card group relative isolate flex min-h-[160px] min-w-0 max-w-full cursor-pointer flex-col justify-between overflow-hidden rounded-3xl p-4 ui-motion duration-300 hover:shadow-lg sm:p-5",
                isOverdue
                    ? "border-red-500/30 [background-color:color-mix(in_srgb,rgb(239_68_68)_6%,var(--surface-card-bg))] hover:border-red-500/50"
                    : isCompleted
                    ? "opacity-60 grayscale-[0.2]"
                    : isProgress
                    ? "border-accent/40 shadow-[0_12px_32px_color-mix(in_srgb,var(--accent)_14%,transparent)]"
                    : isExternal
                    ? "border-dashed border-accent/40 bg-accent/[0.045] hover:border-accent/60"
                    : "hover:border-accent/30"
            )}
        >
            {isExternal && (
                <span
                    className="absolute inset-y-5 left-0 w-1 rounded-r-full bg-accent"
                    aria-hidden="true"
                />
            )}
            {/* Top Bar info */}
            <div className="mb-3 flex min-w-0 items-center justify-between gap-2 border-b border-[var(--border-soft)] pb-3 text-[10px] font-extrabold uppercase tracking-wider">
                <div className="flex min-w-0 items-center gap-1.5 text-[var(--text-muted)]">
                    {isOverdue ? (
                        <AlertCircle className="h-3.5 w-3.5 shrink-0 text-red-500" />
                    ) : (
                        <Calendar className="h-3.5 w-3.5 shrink-0 text-accent" />
                    )}
                    <span className={cn("min-w-0 truncate", isOverdue && "text-red-500")}>
                        {dict.tech?.card_expires_on
                            ? dict.tech.card_expires_on.replace("{date}", formattedDate)
                            : `Expires on ${formattedDate}`}
                    </span>
                </div>
                <span
                    className={cn(
                        "shrink-0 rounded-full border px-2 py-0.5 text-[9px] font-black",
                        isOverdue
                            ? "bg-red-500/10 border-red-500/20 text-red-500"
                            : isCompleted
                            ? "bg-[var(--bg-tertiary)] border-[var(--border-color)] text-[var(--text-muted)]"
                            : isProgress
                            ? "bg-accent border-accent text-white shadow-lg shadow-accent/30"
                            : "bg-accent/10 border-accent/20 text-accent"
                    )}
                >
                    {statusLabel}
                </span>
            </div>

            {/* Main info of the task location */}
            <div className="min-w-0 flex-1 space-y-1">
                {!hideLocationName && (
                    <h3 className="truncate pt-0.5 text-base font-black text-[var(--text-main)] transition-colors group-hover:text-accent">
                        {locationName}
                    </h3>
                )}
                {locationAddress && (
                    <p className="truncate text-[10px] font-bold tracking-wide text-[var(--text-muted)]">
                        {locationAddress}
                    </p>
                )}
                <p className="mt-3 break-words text-xs font-semibold text-[var(--text-main)]">
                    {task.title}
                </p>

                {task.zones && task.zones.length > 0 && (
                    <p className="mt-1 truncate text-[10px] font-bold uppercase tracking-wide text-accent">
                        {task.zones.map((zone) => zone.name).join(" · ")}
                    </p>
                )}

                <TechTaskCardSupplementaryInfo
                    checklistCompleted={checklistProgress.completed}
                    checklistTotal={checklistProgress.total}
                    externalSource={externalSource}
                    isExternal={isExternal}
                    workSummary={workSummary}
                />
            </div>

            {/* Bottom Actions and Navigation Details */}
            <div className="mt-4 flex min-w-0 flex-wrap items-center gap-2 border-t border-[var(--border-soft)] pt-3">
                <div className={cn(
                    "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-white shadow-sm",
                    isOverdue ? "bg-red-500" : isCompleted ? "bg-[var(--text-muted)]" : "bg-accent"
                )}>
                    <MapPin className="h-4 w-4" />
                </div>

                {!isCompleted && (
                    <div className="min-w-0 flex-1 truncate rounded-xl border border-[var(--btn-secondary-border)] bg-[var(--btn-secondary-bg)] px-2.5 py-1.5 text-[9px] font-extrabold uppercase tracking-wider text-[var(--btn-secondary-text)]">
                        <span className="inline-flex max-w-full items-center gap-1.5">
                            <span className="truncate">{reservationSummary}</span>
                            <Flag className="h-3.5 w-3.5 shrink-0 text-[var(--btn-secondary-text)]/70" />
                        </span>
                    </div>
                )}

                {isCompleted ? (
                    <div className="ml-auto flex h-7 w-7 items-center justify-center rounded-full border border-accent/20 bg-accent/10 text-accent">
                        <Check className="h-4 w-4 stroke-[3px]" />
                    </div>
                ) : isPending && canAcceptAssignments ? (
                    <div className="ml-auto flex shrink-0 flex-wrap items-center justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                        <Button
                            size="sm"
                            variant="outline"
                            onClick={() => onReject(task.id)}
                            className="flex h-8 cursor-pointer items-center gap-1 rounded-xl border-none bg-transparent px-3.5 text-[9px] font-black uppercase ui-motion hover:bg-[var(--btn-cancel-bg)] hover:text-[var(--btn-cancel-text)]"
                        >
                            <X className="h-3.5 w-3.5 text-red-500" />
                            {dict.tech.btn_reject}
                        </Button>
                        <Button
                            size="sm"
                            onClick={() => onAccept(task.id)}
                            className="flex h-8 cursor-pointer items-center gap-1 rounded-xl border-none bg-accent px-4 text-[9px] font-black uppercase text-white shadow-sm ui-motion hover:bg-accent-light"
                        >
                            <Check className="h-3.5 w-3.5" />
                            {dict.tech.btn_accept}
                        </Button>
                    </div>
                ) : isAwaitingApproval ? (
                    <div className="ml-auto max-w-full shrink-0" onClick={(e) => e.stopPropagation()}>
                        <Button
                            size="sm"
                            disabled
                            className="flex h-8 max-w-full cursor-not-allowed items-center gap-1 rounded-xl border border-[var(--border-soft)] bg-[var(--bg-primary)] px-3 text-[9px] font-black uppercase text-[var(--text-muted)] sm:px-4"
                        >
                            <Clock className="h-3.5 w-3.5 shrink-0" />
                            <span className="truncate">{dict.tech.msg_accept_first}</span>
                        </Button>
                    </div>
                ) : isPending ? (
                    <div className="ml-auto shrink-0" onClick={(e) => e.stopPropagation()}>
                        <Button
                            size="sm"
                            onClick={() => onViewDetails(task)}
                            className="flex h-8 cursor-pointer items-center gap-1 rounded-xl border-none bg-accent px-4 text-[9px] font-black uppercase text-white shadow-sm ui-motion hover:bg-accent-light"
                        >
                            <Clock className="h-3.5 w-3.5" />
                            {dict.tech?.card_btn_start || "Start"}
                        </Button>
                    </div>
                ) : isRejected && canAcceptAssignments ? (
                    <div className="ml-auto shrink-0" onClick={(e) => e.stopPropagation()}>
                        <Button
                            size="sm"
                            onClick={() => onAccept(task.id)}
                            className="flex h-8 cursor-pointer items-center gap-1 rounded-xl border-none bg-orange-500 px-4 text-[9px] font-black uppercase text-white shadow-sm ui-motion hover:bg-orange-600"
                        >
                            <Check className="h-3.5 w-3.5" />
                            {dict.tech.btn_reaccept ?? "Re-accept"}
                        </Button>
                    </div>
                ) : null}
            </div>
        </div>
    );
}
