"use client";

import React from "react";
import { Clock, CheckCircle2, MapPin, Play, AlertCircle } from "lucide-react";
import { UserStatsResponse, WorkSession } from "@/types/user";
import type { Dictionary } from "@/lib/dictionary-context";
import { cn } from "@/lib/utils";

interface ProfileStatsProps {
    stats: UserStatsResponse | null;
    dict: Dictionary;
    activeSession: WorkSession | undefined;
    activeSessionTime: string;
    formatTime: (dateStr: string | null) => string;
}

export function ProfileStats({
    stats,
    dict,
    activeSession,
    activeSessionTime,
    formatTime,
}: ProfileStatsProps) {
    const hoursValue =
        stats?.total_hours_worked != null ? stats.total_hours_worked.toFixed(1) : "0.0";
    const hoursDetail = dict.profile?.stats?.hours_count
        ? dict.profile.stats.hours_count.replace(
              "{hours}",
              stats?.total_hours_worked != null ? stats.total_hours_worked.toFixed(1) : "0",
          )
        : "";
    const tasksCompleted = stats?.tasks_completed || 0;
    const tasksTotal = stats?.total_tasks || 0;
    const tasksDetail = dict.profile?.stats?.tasks_count
        ? dict.profile.stats.tasks_count
              .replace("{completed}", tasksCompleted.toString())
              .replace("{total}", tasksTotal.toString())
        : "";
    const locationsValue = stats?.locations_worked_count || 0;
    const locationsDetail = dict.profile?.stats?.locations_count
        ? dict.profile.stats.locations_count.replace("{count}", locationsValue.toString())
        : "";
    const progress =
        tasksTotal > 0 ? Math.min(100, (tasksCompleted / tasksTotal) * 100) : 0;

    return (
        <section
            className="grid grid-cols-2 gap-2.5 lg:grid-cols-4"
            aria-label={dict.profile?.stats?.hours_worked || "Estadísticas"}
        >
            <article className="billing-block rounded-[18px] p-3.5">
                <span
                    className="flex h-8 w-8 items-center justify-center rounded-xl bg-[var(--bg-card-solid)] text-accent"
                    aria-hidden="true"
                >
                    <Clock className="h-4 w-4" />
                </span>
                <p className="mt-3 text-[9px] font-semibold uppercase tracking-wide text-[var(--text-muted)] sm:text-[10px]">
                    {dict.profile?.stats?.hours_worked || "Horas Trabajadas"}
                </p>
                <p className="mt-1 text-xl font-semibold text-[var(--text-main)] sm:text-2xl">
                    {hoursValue}
                </p>
                {hoursDetail ? (
                    <p className="mt-1.5 text-[11px] font-medium text-[var(--text-muted)]">{hoursDetail}</p>
                ) : null}
            </article>

            <article className="billing-block rounded-[18px] p-3.5">
                <span
                    className="flex h-8 w-8 items-center justify-center rounded-xl bg-[var(--bg-card-solid)] text-accent"
                    aria-hidden="true"
                >
                    <CheckCircle2 className="h-4 w-4" />
                </span>
                <p className="mt-3 text-[9px] font-semibold uppercase tracking-wide text-[var(--text-muted)] sm:text-[10px]">
                    {dict.profile?.stats?.tasks_completed || "Tareas Completadas"}
                </p>
                <p className="mt-1 text-xl font-semibold text-[var(--text-main)] sm:text-2xl">
                    {tasksCompleted}
                </p>
                {tasksDetail ? (
                    <p className="mt-1.5 text-[11px] font-medium text-[var(--text-muted)]">{tasksDetail}</p>
                ) : null}
                <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-[var(--bg-card-solid)]">
                    <div
                        className="h-1.5 rounded-full bg-[var(--color-green-500)] transition-[width] duration-500"
                        style={{ width: `${progress}%` }}
                    />
                </div>
            </article>

            <article className="billing-block rounded-[18px] p-3.5">
                <span
                    className="flex h-8 w-8 items-center justify-center rounded-xl bg-[var(--bg-card-solid)] text-accent"
                    aria-hidden="true"
                >
                    <MapPin className="h-4 w-4" />
                </span>
                <p className="mt-3 text-[9px] font-semibold uppercase tracking-wide text-[var(--text-muted)] sm:text-[10px]">
                    {dict.profile?.stats?.locations_visited || "Ubicaciones Visitadas"}
                </p>
                <p className="mt-1 text-xl font-semibold text-[var(--text-main)] sm:text-2xl">
                    {locationsValue}
                </p>
                {locationsDetail ? (
                    <p className="mt-1.5 text-[11px] font-medium text-[var(--text-muted)]">
                        {locationsDetail}
                    </p>
                ) : null}
            </article>

            <article
                className={cn(
                    "billing-block rounded-[18px] p-3.5",
                    activeSession && "ring-1 ring-accent/25",
                )}
            >
                <span
                    className={cn(
                        "flex h-8 w-8 items-center justify-center rounded-xl bg-[var(--bg-card-solid)] text-accent",
                        activeSession && "animate-pulse",
                    )}
                    aria-hidden="true"
                >
                    {activeSession ? (
                        <Play className="h-4 w-4 fill-accent" />
                    ) : (
                        <AlertCircle className="h-4 w-4" />
                    )}
                </span>
                <p className="mt-3 text-[9px] font-semibold uppercase tracking-wide text-[var(--text-muted)] sm:text-[10px]">
                    {dict.profile?.stats?.active_shift || "Jornada Activa"}
                </p>
                <p className="mt-1 font-mono text-xl font-semibold text-[var(--text-main)] sm:text-2xl">
                    {activeSession ? activeSessionTime : "--:--:--"}
                </p>
                <p className="mt-1.5 text-[11px] font-medium">
                    {activeSession ? (
                        <span className="text-accent">
                            {dict.profile?.stats?.session_started_at || "Sesión iniciada a las"}{" "}
                            {formatTime(activeSession.start_time)}
                        </span>
                    ) : (
                        <span className="text-[var(--text-muted)]">
                            {dict.profile?.stats?.no_active_shift || "Sin Jornada Activa"}
                        </span>
                    )}
                </p>
            </article>
        </section>
    );
}
