"use client";

import { Calendar, Timer } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { TaskItem } from "@/types/user";
import { cleanChecklistDescription } from "@/lib/format";
import { formatHoursShort } from "@/lib/format-hours";
import { formatWorkedTime, formatClockTime } from "./utils";

interface WorkerSummary {
    user_id: number;
    user_name: string;
    total_seconds: number;
    is_active: boolean;
}

interface TechTaskHeaderInfoProps {
    task: TaskItem;
    locationTypeLabel: string;
    serviceContextLabel: string;
    priorityBadge: { className: string; text: string };
    plannedDate: string | null;
    dueDate: string | null;
    checkoutDate: string | null;
    locale: string;
    taskWorkSeconds: number;
    activeWorkers: number;
    workers: WorkerSummary[] | undefined;
    isCurrentTaskSessionActive: boolean;
    personalElapsedSeconds: number;
    isParsedChecklist: boolean;
}

export function TechTaskHeaderInfo({
    task,
    locationTypeLabel,
    serviceContextLabel,
    priorityBadge,
    plannedDate,
    dueDate,
    checkoutDate,
    locale,
    taskWorkSeconds,
    activeWorkers,
    workers,
    isCurrentTaskSessionActive,
    personalElapsedSeconds,
    isParsedChecklist,
}: TechTaskHeaderInfoProps) {
    return (
        <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
                <Badge
                    variant="secondary"
                    className="rounded-lg border-0 bg-accent/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-accent"
                >
                    <Calendar className="h-3 w-3" />
                    {checkoutDate
                        ? `${locale === "es" ? "Huéspedes · salida" : "Guests · check-out"} ${checkoutDate}`
                        : serviceContextLabel}
                </Badge>
                <Badge
                    variant="outline"
                    className="rounded-lg px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]"
                >
                    {locationTypeLabel}
                </Badge>
                {task.zones && task.zones.length > 0 && (
                    <Badge
                        variant="outline"
                        className="max-w-full truncate rounded-lg px-2 py-0.5 text-[10px] font-semibold text-accent"
                        title={task.zones.map((zone) => zone.name).join(", ")}
                    >
                        {task.zones.map((zone) => zone.name).join(", ")}
                    </Badge>
                )}
            </div>

            <div className="flex flex-wrap items-start justify-between gap-2">
                <h1 className="min-w-0 flex-1 text-lg font-semibold leading-snug tracking-tight text-[var(--text-main)] sm:text-xl">
                    {task.title}
                </h1>
                <Badge
                    variant="outline"
                    className={cn(
                        "shrink-0 rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
                        priorityBadge.className,
                    )}
                >
                    {priorityBadge.text}
                </Badge>
            </div>

            <div className="billing-block space-y-2 rounded-2xl px-3.5 py-3">
                <div className="flex items-center gap-2 text-xs font-medium text-[var(--text-muted)]">
                    <Calendar className="h-3.5 w-3.5 shrink-0 text-accent" />
                    <span>
                        {locale === "es" ? "Planificada:" : "Scheduled:"}{" "}
                        <span className="font-semibold text-[var(--text-main)]">
                            {plannedDate || (locale === "es" ? "Sin fecha" : "No date")}
                        </span>
                        {task.next_reservation && dueDate && dueDate !== plannedDate && (
                            <span className="ml-1.5">
                                · {locale === "es" ? "límite" : "due"}{" "}
                                <span className="font-semibold text-[var(--text-main)]">{dueDate}</span>
                            </span>
                        )}
                    </span>
                </div>

                <div className="flex items-center gap-2 text-xs font-medium text-[var(--text-muted)]">
                    <Timer className="h-3.5 w-3.5 shrink-0 text-accent" />
                    <span>
                        {locale === "es" ? "Tiempo total del equipo:" : "Team total time:"}{" "}
                        <span className="font-semibold text-[var(--text-main)]">{formatWorkedTime(taskWorkSeconds)}</span>
                        {activeWorkers > 0 && (
                            <span className="ml-1.5 text-accent">
                                · {activeWorkers} {activeWorkers === 1 ? "activo" : "activos"}
                            </span>
                        )}
                    </span>
                </div>

                {workers && workers.length > 0 && (
                    <div className="space-y-1 border-t border-[var(--border-soft)] pt-2">
                        {workers.map((w) => (
                            <div key={w.user_id} className="flex items-center gap-2 text-[11px] font-medium text-[var(--text-muted)]">
                                <span className="font-semibold text-[var(--text-main)]">{w.user_name}</span>
                                <span>—</span>
                                <span className="font-mono tabular-nums">{formatHoursShort(w.total_seconds)}</span>
                                {w.is_active && (
                                    <span className="h-1.5 w-1.5 rounded-full bg-accent animate-pulse" />
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {isCurrentTaskSessionActive && (
                <div className="billing-block flex items-center justify-between gap-3 rounded-2xl border border-accent/20 bg-accent/[0.07] px-3.5 py-3">
                    <span className="flex items-center gap-2 text-xs font-semibold text-accent">
                        <span className="h-2 w-2 rounded-full bg-accent animate-pulse" />
                        {locale === "es" ? "Mi jornada en curso" : "My active shift"}
                    </span>
                    <span className="font-mono text-base font-semibold tabular-nums text-[var(--text-main)]">
                        {formatClockTime(personalElapsedSeconds)}
                    </span>
                </div>
            )}

            {task.description && !isParsedChecklist && (
                <div className="billing-block space-y-1.5 rounded-2xl px-3.5 py-3">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                        {locale === "es" ? "Descripción" : "Description"}
                    </span>
                    <p className="text-xs font-medium leading-relaxed text-[var(--text-muted)]">
                        {cleanChecklistDescription(task.description)}
                    </p>
                </div>
            )}

            {task.checkout_reservation?.notes && (
                <div className="rounded-2xl border border-orange-500/25 bg-orange-500/[0.07] px-3.5 py-3">
                    <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wider text-orange-700 dark:text-orange-300">
                        <span className="flex h-4 w-4 items-center justify-center rounded-full bg-orange-500 text-[10px] font-bold text-white">!</span>
                        {locale === "es" ? "Indicaciones de la empresa emisora" : "Issuer instructions"}
                    </div>
                    <p className="mt-2 text-xs font-medium leading-relaxed text-[var(--text-main)]">
                        {task.checkout_reservation.notes}
                    </p>
                </div>
            )}
        </div>
    );
}
