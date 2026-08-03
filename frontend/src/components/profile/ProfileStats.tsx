"use client";

import React from "react";
import { Clock, CheckCircle2, MapPin, Play, AlertCircle } from "lucide-react";
import { UserStatsResponse, WorkSession } from "@/types/user";
import type { Dictionary } from "@/lib/dictionary-context";

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
    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Hours worked */}
            <div className="bg-[var(--bg-card)] border border-[var(--border-soft)] rounded-2xl p-6 shadow-xs transition-transform duration-300 hover:-translate-y-1">
                <div className="flex items-center justify-between mb-4">
                    <span className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider">
                        {dict.profile?.stats?.hours_worked || "Horas Trabajadas"}
                    </span>
                    <div className="w-8 h-8 rounded-lg bg-accent/5 border border-accent/10 flex items-center justify-center text-accent">
                        <Clock className="h-4 w-4" />
                    </div>
                </div>
                <div className="space-y-1.5">
                    <h3 className="text-2xl font-black tracking-tight">
                        {stats?.total_hours_worked != null ? stats.total_hours_worked.toFixed(1) : "0.0"}
                    </h3>
                    <p className="text-2xs text-[var(--text-muted)] font-medium">
                        {dict.profile?.stats?.hours_count
                            ? dict.profile.stats.hours_count.replace(
                                "{hours}",
                                stats?.total_hours_worked != null ? stats.total_hours_worked.toFixed(1) : "0"
                              )
                            : ""}
                    </p>
                </div>
            </div>

            {/* Completed tasks */}
            <div className="bg-[var(--bg-card)] border border-[var(--border-soft)] rounded-2xl p-6 shadow-xs transition-transform duration-300 hover:-translate-y-1">
                <div className="flex items-center justify-between mb-4">
                    <span className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider">
                        {dict.profile?.stats?.tasks_completed || "Tareas Completadas"}
                    </span>
                    <div className="w-8 h-8 rounded-lg bg-accent/5 border border-accent/10 flex items-center justify-center text-accent">
                        <CheckCircle2 className="h-4 w-4" />
                    </div>
                </div>
                <div className="space-y-1.5">
                    <h3 className="text-2xl font-black tracking-tight">
                        {stats?.tasks_completed || "0"}
                    </h3>
                    <p className="text-2xs text-[var(--text-muted)] font-medium">
                        {dict.profile?.stats?.tasks_count
                             ? dict.profile.stats.tasks_count
                                 .replace("{completed}", (stats?.tasks_completed || 0).toString())
                                 .replace("{total}", (stats?.total_tasks || 0).toString())
                             : ""}
                    </p>
                </div>
                <div className="w-full bg-[var(--bg-tertiary)] rounded-full h-1.5 mt-4 overflow-hidden">
                    <div
                        className="bg-green-500 h-1.5 rounded-full transition-[width] duration-500"
                        style={{
                            width: `${
                                stats?.total_tasks
                                    ? (stats.tasks_completed / stats.total_tasks) * 100
                                    : 0
                            }%`,
                        }}
                    />
                </div>
            </div>

            {/* Locations visited */}
            <div className="bg-[var(--bg-card)] border border-[var(--border-soft)] rounded-2xl p-6 shadow-xs transition-transform duration-300 hover:-translate-y-1">
                <div className="flex items-center justify-between mb-4">
                    <span className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider">
                        {dict.profile?.stats?.locations_visited || "Ubicaciones Visitadas"}
                    </span>
                    <div className="w-8 h-8 rounded-lg bg-accent/5 border border-accent/10 flex items-center justify-center text-accent">
                        <MapPin className="h-4 w-4" />
                    </div>
                </div>
                <div className="space-y-1.5">
                    <h3 className="text-2xl font-black tracking-tight">
                        {stats?.locations_worked_count || "0"}
                    </h3>
                    <p className="text-2xs text-[var(--text-muted)] font-medium">
                        {dict.profile?.stats?.locations_count
                            ? dict.profile.stats.locations_count.replace(
                                "{count}",
                                (stats?.locations_worked_count || 0).toString()
                              )
                            : ""}
                    </p>
                </div>
            </div>

            {/* Active clock-in or shift */}
            <div
                className={`border rounded-2xl p-6 shadow-xs transition-transform duration-300 ${
                    activeSession
                        ? "bg-accent/5 border-accent/20"
                        : "bg-[var(--bg-card)] border-[var(--border-soft)] hover:-translate-y-1"
                }`}
            >
                <div className="flex items-center justify-between mb-4">
                    <span className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider">
                        {dict.profile?.stats?.active_shift || "Jornada Activa"}
                    </span>
                    <div
                        className={`w-8 h-8 rounded-lg border flex items-center justify-center text-accent ${
                            activeSession
                                ? "bg-accent/20 border-accent/30 animate-pulse"
                                : "bg-accent/5 border-accent/10"
                        }`}
                    >
                        {activeSession ? (
                            <Play className="h-4 w-4 fill-accent" />
                        ) : (
                            <AlertCircle className="h-4 w-4" />
                        )}
                    </div>
                </div>
                <div className="space-y-1.5">
                    <h3 className="text-2xl font-black font-mono tracking-tight">
                        {activeSession ? activeSessionTime : "--:--:--"}
                    </h3>
                    <p className="text-2xs font-semibold mt-0.5">
                        {activeSession ? (
                            <span className="text-accent">
                                {dict.profile?.stats?.session_started_at || "Sesión iniciada a las"} {formatTime(activeSession.start_time)}
                            </span>
                        ) : (
                            <span className="text-[var(--text-muted)] font-medium">
                                {dict.profile?.stats?.no_active_shift || "Sin Jornada Activa"}
                            </span>
                        )}
                    </p>
                </div>
            </div>
        </div>
    );
}
