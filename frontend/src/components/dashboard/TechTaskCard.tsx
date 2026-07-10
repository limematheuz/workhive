import React, { useState, useEffect } from "react";
import { Clock, MapPin, Check, X, MessageSquare, Download, Calendar, Flag, AlertCircle, Timer } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { TaskItem, User, TaskWorkDetailedSummary } from "@/types/user";
import { useDictionary } from "@/lib/dictionary-context";
import { getUserTaskStatus } from "@/lib/format";
import { WorkSessionService } from "@/services/work-session.service";
import { formatHoursShort } from "@/lib/format-hours";
import { canManageCompanyTasks } from "@/domain/access/roles";

interface TechTaskCardProps {
    task: TaskItem;
    locationName: string;
    locationAddress?: string;
    currentUser?: User | null;
    onAccept: (taskId: number) => void;
    onReject: (taskId: number) => void;
    onViewDetails: (task: TaskItem) => void;
    hideLocationName?: boolean;
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
}: TechTaskCardProps) {
    const { dict, locale } = useDictionary();
    const canAcceptAssignments = canManageCompanyTasks(currentUser);

    const [workSummary, setWorkSummary] = useState<TaskWorkDetailedSummary | null>(null);

    useEffect(() => {
        let cancelled = false;
        WorkSessionService.getTaskDetailedSummary(task.id)
            .then((data) => { if (!cancelled) setWorkSummary(data); })
            .catch(() => {});
        return () => { cancelled = true; };
    }, [task.id]);

    const userStatus = React.useMemo(() => {
        if (!currentUser) return task.status;
        return getUserTaskStatus(task, currentUser.id);
    }, [task, currentUser]);
    const displayStatus = canAcceptAssignments ? task.status : userStatus;

    const isCompleted = displayStatus === "completed";
    const isProgress = displayStatus === "progress" || displayStatus === "review";
    const isAccepted = displayStatus === "accepted";
    const isRejected = displayStatus === "rejected";
    const isPending = displayStatus === "pending";

    const planningDate = task.scheduled_start_at || task.due_at || task.created_at;

    // Check if task is overdue (due/planning date passed and not completed)
    const isOverdue = React.useMemo(() => {
        if (isCompleted) return false;
        const taskDate = new Date(planningDate);
        const now = new Date();
        return taskDate.getTime() < now.getTime();
    }, [planningDate, isCompleted]);

    const formattedDate = React.useMemo(() => {
        try {
            const date = new Date(planningDate);
            return date.toLocaleDateString(locale === "en" ? "en-US" : "es-ES", {
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
                "group relative rounded-3xl border p-5 transition-all duration-300 flex flex-col justify-between min-h-[160px] cursor-pointer shadow-sm hover:shadow-lg bg-[var(--bg-card)]",
                isOverdue
                    ? "border-red-500/30 bg-red-500/[0.02] hover:border-red-500/50"
                    : isCompleted
                    ? "border-[var(--border-soft)] bg-zinc-500/5 opacity-60 grayscale-[0.2]"
                    : "border-[var(--border-soft)] hover:border-accent/30"
            )}
        >
            {/* Top Bar info */}
            <div className="flex items-center justify-between gap-2 border-b border-[var(--border-soft)] pb-3 mb-3 text-[10px] font-extrabold uppercase tracking-wider">
                <div className="flex items-center gap-1.5 text-[var(--text-muted)]">
                    {isOverdue ? (
                        <AlertCircle className="w-3.5 h-3.5 text-red-500 animate-pulse" />
                    ) : (
                        <Calendar className="w-3.5 h-3.5 text-accent" />
                    )}
                    <span className={cn(isOverdue && "text-red-500")}>
                        {dict.tech?.card_expires_on
                            ? dict.tech.card_expires_on.replace("{date}", formattedDate)
                            : `Expires on ${formattedDate}`}
                    </span>
                </div>
                <span
                    className={cn(
                        "text-[9px] font-black px-2 py-0.5 rounded-full border",
                        isOverdue
                            ? "bg-red-500/10 border-red-500/20 text-red-500"
                            : isCompleted
                            ? "bg-zinc-500/10 border-zinc-500/20 text-zinc-500"
                            : isProgress
                            ? "bg-accent/10 border-accent/20 text-accent animate-pulse"
                            : "bg-accent/10 border-accent/20 text-accent dark:text-accent"
                    )}
                >
                    {statusLabel}
                </span>
            </div>

            {/* Main info of the task location */}
            <div className="flex-1 space-y-1">
                {!hideLocationName && (
                    <h3 className="text-base font-black text-[var(--text-main)] group-hover:text-accent transition-colors pt-0.5">
                        {locationName}
                    </h3>
                )}
                {locationAddress && (
                    <p className="text-[10px] text-[var(--text-muted)] font-bold tracking-wide">
                        {locationAddress}
                    </p>
                )}
                <p className="text-xs text-[var(--text-main)] font-semibold mt-3">
                    {task.title}
                </p>

                {workSummary && workSummary.total_seconds > 0 && (
                    <div className="mt-2 flex flex-wrap items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                        <span className="text-[9px] font-bold text-[var(--text-muted)] flex items-center gap-1">
                            <Timer className="w-3.5 h-3.5 text-accent" />
                            {formatHoursShort(workSummary.total_seconds)}
                        </span>
                        {workSummary.workers.map((w) => (
                            <span
                                key={w.user_id}
                                className="text-[9px] bg-accent/10 text-accent dark:text-accent border border-accent/20 px-1.5 py-0.5 rounded-md font-bold flex items-center gap-1"
                                title={`${w.user_name}: ${formatHoursShort(w.total_seconds)}`}
                            >
                                {w.user_name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2)} {formatHoursShort(w.total_seconds)}
                                {w.is_active && <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />}
                            </span>
                        ))}
                    </div>
                )}
            </div>

            {/* Bottom Actions and Navigation Details */}
            <div className="mt-4 pt-3.5 border-t border-[var(--border-soft)] flex items-center justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-2">
                    {/* Direction/Route Indicator Icon */}
                    <div className={cn(
                        "w-7 h-7 rounded-full flex items-center justify-center text-white shadow-sm shrink-0",
                        isOverdue ? "bg-orange-500" : isCompleted ? "bg-zinc-400" : "bg-accent"
                    )}>
                        <MapPin className="w-4 h-4" />
                    </div>

                    {/* Check-out Hours Badge */}
                    {!isCompleted && (
                        <div className="bg-[var(--btn-secondary-bg)] px-3 py-1.5 rounded-xl border border-[var(--btn-secondary-border)] flex items-center gap-1.5 text-[9px] font-extrabold uppercase text-[var(--btn-secondary-text)] tracking-wider">
                            <span>
                                {reservationSummary}
                            </span>
                            <Flag className="w-3.5 h-3.5 text-[var(--btn-secondary-text)]/70 ml-0.5" />
                        </div>
                    )}
                </div>

                {/* Status-specific triggers / icons */}
                <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                    {isPending && canAcceptAssignments ? (
                        <>
                            <Button
                                size="sm"
                                variant="outline"
                                onClick={() => onReject(task.id)}
                                className="bg-transparent border-[var(--border-soft)] text-[9px] font-black uppercase hover:bg-[var(--btn-cancel-bg)] hover:text-[var(--btn-cancel-text)] px-3.5 h-8 rounded-xl transition-all flex items-center gap-1 border-none cursor-pointer"
                            >
                                <X className="w-3.5 h-3.5 text-red-500" />
                                {dict.tech.btn_reject}
                            </Button>
                            <Button
                                size="sm"
                                onClick={() => onAccept(task.id)}
                                className="bg-accent hover:bg-accent-light text-white text-[9px] font-black uppercase px-4 h-8 rounded-xl transition-all shadow-sm border-none cursor-pointer flex items-center gap-1"
                            >
                                <Check className="w-3.5 h-3.5" />
                                {dict.tech.btn_accept}
                            </Button>
                        </>
                    ) : isPending ? (
                        <Button
                            size="sm"
                            onClick={() => onViewDetails(task)}
                            className="bg-accent hover:bg-accent-light text-white text-[9px] font-black uppercase px-4 h-8 rounded-xl transition-all shadow-sm border-none cursor-pointer flex items-center gap-1"
                        >
                            <Clock className="w-3.5 h-3.5" />
                            {dict.tech?.card_btn_start || "Start"}
                        </Button>
                    ) : isRejected && canAcceptAssignments ? (
                        <Button
                            size="sm"
                            onClick={() => onAccept(task.id)}
                            className="bg-orange-500 hover:bg-orange-600 text-white text-[9px] font-black uppercase px-4 h-8 rounded-xl transition-all shadow-sm border-none cursor-pointer flex items-center gap-1"
                        >
                            <Check className="w-3.5 h-3.5" />
                            {dict.tech.btn_reaccept ?? "Re-accept"}
                        </Button>
                    ) : (
                        <div className="flex items-center gap-3 text-[var(--text-muted)]">
                            <button type="button" aria-label={dict.tech.comments_title} className="p-1.5 hover:text-accent transition-colors bg-transparent border-none cursor-pointer">
                                <MessageSquare className="w-4.5 h-4.5" />
                            </button>
                            {isCompleted ? (
                                <div className="w-7 h-7 rounded-full bg-accent/10 border border-accent/20 text-accent flex items-center justify-center">
                                    <Check className="w-4 h-4 stroke-[3px]" />
                                </div>
                            ) : (
                                <button type="button" aria-label="Descargar" className="p-1.5 hover:text-accent transition-colors bg-transparent border-none cursor-pointer">
                                    <Download className="w-4.5 h-4.5" />
                                </button>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
