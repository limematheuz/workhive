"use client";

import React from "react";
import { Calendar } from "lucide-react";
import { cn } from "@/lib/utils";
import { TaskItem } from "@/types/user";
import { Location } from "@/types/location";
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
    location: Location | null;
    locationName: string;
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
    location,
    locationName,
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
        <>
            <div className="bg-[var(--bg-primary)]/45 p-4 border border-[var(--border-soft)] rounded-2xl flex flex-col justify-center">
                <span className="text-[9px] font-black uppercase text-accent tracking-wider">
                    {locationTypeLabel}
                </span>
                <h2 className="text-base font-black text-[var(--text-main)] tracking-tight mt-0.5">{locationName}</h2>
                {location?.address && (
                    <span className="text-[10px] text-[var(--text-muted)] font-medium mt-0.5">{location.address}, {location.city}</span>
                )}
            </div>

            <div className="bg-[var(--bg-primary)]/15 px-4 py-2.5 border border-[var(--border-soft)] rounded-xl flex items-center gap-2 text-2xs font-extrabold uppercase text-[var(--text-muted)] tracking-wider">
                <Calendar className="w-3.5 h-3.5 text-accent" />
                <span>
                    {checkoutDate
                        ? `${locale === "es" ? "Huéspedes · salida" : "Guests · check-out"} ${checkoutDate}`
                        : serviceContextLabel}
                </span>
            </div>

            <div className="space-y-2">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                    <h1 className="text-lg font-black text-[var(--text-main)]">{task.title}</h1>
                    <span className={cn("text-[9px] font-black tracking-wider uppercase px-3 py-1 rounded-full", priorityBadge.className)}>
                        {priorityBadge.text}
                    </span>
                </div>

                <div className="flex items-center gap-2 text-xs font-bold text-[var(--text-muted)]">
                    <Calendar className="w-3.5 h-3.5 text-accent" />
                    <span>
                        {locale === "es" ? "Planificada:" : "Scheduled:"}{" "}
                        <span className="text-[var(--text-main)]">
                            {plannedDate || (locale === "es" ? "Sin fecha" : "No date")}
                        </span>
                        {task.next_reservation && dueDate && dueDate !== plannedDate && (
                            <span className="ml-2">
                                · {locale === "es" ? "límite" : "due"}{" "}
                                <span className="text-[var(--text-main)]">{dueDate}</span>
                            </span>
                        )}
                    </span>
                </div>

                <div className="flex items-center gap-2 text-xs font-bold text-[var(--text-muted)]">
                    <Calendar className="w-3.5 h-3.5 text-accent" />
                    <span>
                        {locale === "es" ? "Tiempo total del equipo:" : "Team total time:"}{" "}
                        <span className="text-[var(--text-main)]">{formatWorkedTime(taskWorkSeconds)}</span>
                        {activeWorkers > 0 && (
                            <span className="ml-2 text-accent">
                                · {activeWorkers} {activeWorkers === 1 ? "activo" : "activos"}
                            </span>
                        )}
                    </span>
                </div>

                {workers && workers.length > 0 && (
                    <div className="space-y-1 pl-6">
                        {workers.map((w) => (
                            <div key={w.user_id} className="flex items-center gap-2 text-[10px] text-[var(--text-muted)] font-semibold">
                                <span className="text-[var(--text-main)] font-bold">{w.user_name}</span>
                                <span>—</span>
                                <span className="font-mono">{formatHoursShort(w.total_seconds)}</span>
                                {w.is_active && (
                                    <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
                                )}
                            </div>
                        ))}
                    </div>
                )}

                {isCurrentTaskSessionActive && (
                    <div className="flex items-center justify-between gap-3 rounded-xl border border-accent/20 bg-accent/[0.07] px-3.5 py-3">
                        <span className="flex items-center gap-2 text-xs font-black text-accent dark:text-accent">
                            <span className="h-2 w-2 rounded-full bg-accent animate-pulse" />
                            {locale === "es" ? "Mi jornada en curso" : "My active shift"}
                        </span>
                        <span className="font-mono text-base font-black text-[var(--text-main)]">
                            {formatClockTime(personalElapsedSeconds)}
                        </span>
                    </div>
                )}

                {task.description && !isParsedChecklist && (
                    <div className="space-y-1 pt-1">
                        <span className="text-[9px] font-black uppercase tracking-wider text-[var(--text-muted)]">{locale === "es" ? "Descripción" : "Description"}</span>
                        <p className="text-xs text-[var(--text-muted)] leading-relaxed font-medium bg-[var(--bg-primary)]/5 p-3.5 border border-[var(--border-soft)] rounded-xl">
                            {cleanChecklistDescription(task.description)}
                        </p>
                    </div>
                )}

                {task.checkout_reservation?.notes && (
                    <div className="rounded-xl border border-orange-500/25 bg-orange-500/[0.07] p-3.5">
                        <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-wider text-orange-700 dark:text-orange-300">
                            <span className="h-4 w-4 bg-orange-500 rounded-full flex items-center justify-center text-white text-[10px] font-black">!</span>
                            {locale === "es" ? "Indicaciones de la empresa emisora" : "Issuer instructions"}
                        </div>
                        <p className="mt-2 text-xs font-medium leading-relaxed text-[var(--text-main)]">
                            {task.checkout_reservation.notes}
                        </p>
                    </div>
                )}
            </div>
        </>
    );
}
