"use client";

import React from "react";
import { Briefcase, Calendar, Clock3, MapPin, Users } from "lucide-react";
import { ActiveCompanySession, WorkSession, TaskItem } from "@/types/user";
import { cleanChecklistDescription } from "@/lib/format";
import { PremiumTabs } from "@/components/ui/premium-tabs";
import { WorkStartLocationLink } from "@/components/work-sessions/WorkStartLocationLink";
import type { Dictionary } from "@/lib/dictionary-context";

const formatElapsed = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return [hours, minutes, secs]
        .map(value => value.toString().padStart(2, "0"))
        .join(":");
};

interface ProfileHistoriesProps {
    activeTab: "sessions" | "tasks" | "team";
    setActiveTab: (tab: "sessions" | "tasks" | "team") => void;
    sessions: WorkSession[];
    tasks: TaskItem[];
    locationsMap: Map<number, string>;
    dict: Dictionary;
    formatDate: (dateStr: string) => string;
    formatTime: (dateStr: string | null) => string;
    calculateDuration: (start: string, end: string | null) => string | null;
    activeSessionTime: string;
    activeCompanySessions: ActiveCompanySession[];
    canViewActiveTeam: boolean;
}

export function ProfileHistories({
    activeTab,
    setActiveTab,
    sessions,
    tasks,
    locationsMap,
    dict,
    formatDate,
    formatTime,
    calculateDuration,
    activeSessionTime,
    activeCompanySessions,
    canViewActiveTeam,
}: ProfileHistoriesProps) {
    return (
        <div className="bg-[var(--bg-card)] border border-[var(--border-soft)] rounded-3xl shadow-lg overflow-hidden">
            <div className="p-4 border-b border-[var(--border-soft)]">
                <PremiumTabs
                    tabs={[
                        { id: "sessions" as const, label: dict.profile?.tabs?.work_history || "Historial de Jornadas" },
                        { id: "tasks" as const, label: dict.profile?.tabs?.task_history || "Historial de Tareas" },
                        ...(canViewActiveTeam
                            ? [{ id: "team" as const, label: dict.profile?.tabs?.live_team ? dict.profile.tabs.live_team.replace("{count}", activeCompanySessions.length.toString()) : `Equipo en vivo (${activeCompanySessions.length})`, icon: Users }]
                            : [])
                    ]}
                    activeTab={activeTab}
                    onChange={setActiveTab}
                />
            </div>

            <div className="p-6 overflow-x-auto">
                {activeTab === "team" ? (
                    activeCompanySessions.length === 0 ? (
                        <div className="py-14 text-center">
                            <Users className="mx-auto h-7 w-7 text-[var(--text-muted)]" />
                            <p className="mt-3 text-sm font-bold text-[var(--text-main)]">
                                {dict.profile?.team?.no_active_workers || "No hay trabajadores con jornada activa"}
                            </p>
                            <p className="mt-1 text-xs font-medium text-[var(--text-muted)]">
                                {dict.profile?.team?.view_updates_automatically || "Esta vista se actualiza automáticamente."}
                            </p>
                        </div>
                    ) : (
                        <div className="grid gap-3 md:grid-cols-2">
                            {activeCompanySessions.map(session => (
                                <div
                                    key={session.id}
                                    className="rounded-2xl border border-[var(--border-soft)] bg-[var(--bg-secondary)] p-4"
                                >
                                    <div className="flex items-start justify-between gap-4">
                                        <div className="min-w-0">
                                            <p className="truncate text-sm font-black text-[var(--text-main)]">
                                                {session.user_name}
                                            </p>
                                            <p className="truncate text-xs font-medium text-[var(--text-muted)]">
                                                {session.user_email}
                                            </p>
                                        </div>
                                        <span className="flex shrink-0 items-center gap-1.5 rounded-full border border-accent/20 bg-accent/10 px-2.5 py-1 text-xs font-black text-accent">
                                            <span className="h-2 w-2 rounded-full bg-accent animate-pulse" />
                                            {formatElapsed(session.elapsed_seconds)}
                                        </span>
                                    </div>
                                    <div className="mt-4 grid gap-2 text-xs font-semibold text-[var(--text-muted)]">
                                        <span className="flex items-center gap-2">
                                            <MapPin className="h-4 w-4 text-accent" />
                                            {session.location_name}
                                        </span>
                                        <span className="flex items-center gap-2">
                                            <Clock3 className="h-4 w-4 text-accent" />
                                            {dict.profile?.team?.started_at ? dict.profile.team.started_at.replace("{time}", formatTime(session.start_time)) : `Jornada iniciada a las ${formatTime(session.start_time)}`}
                                        </span>
                                        <span className="flex items-center gap-2">
                                            <Briefcase className="h-4 w-4 text-accent" />
                                            {session.task_title || (dict.profile?.team?.general_shift || "Jornada general en la ubicación")}
                                        </span>
                                        {session.start_latitude !== null
                                            && session.start_latitude !== undefined
                                            && session.start_longitude !== null
                                            && session.start_longitude !== undefined && (
                                            <WorkStartLocationLink
                                                latitude={session.start_latitude}
                                                longitude={session.start_longitude}
                                                accuracyMeters={session.start_accuracy_meters}
                                                label={dict.profile?.team?.view_start_location || "Ver ubicación del fichaje"}
                                            />
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )
                ) : activeTab === "sessions" ? (
                    sessions.length === 0 ? (
                        <div className="py-12 text-center text-[var(--text-muted)] text-xs font-semibold">
                            {dict.profile?.tables?.empty_sessions || "No tienes jornadas registradas."}
                        </div>
                    ) : (
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="border-b border-[var(--border-soft)] text-2xs uppercase font-bold tracking-wider text-[var(--text-muted)] pb-4">
                                    <th className="pb-4 font-bold">{dict.profile?.tables?.date || "Fecha"}</th>
                                    <th className="pb-4 font-bold">{dict.profile?.tables?.location || "Ubicación"}</th>
                                    <th className="pb-4 font-bold">{dict.profile?.tables?.start_time || "Entrada"}</th>
                                    <th className="pb-4 font-bold">{dict.profile?.tables?.end_time || "Salida"}</th>
                                    <th className="pb-4 font-bold">{dict.profile?.tables?.duration || "Duración"}</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-[var(--border-soft)]/50 text-sm">
                                {sessions.map((sess) => (
                                    <tr key={sess.id} className="hover:bg-white/[0.01] transition-colors">
                                        <td className="py-4 font-semibold flex items-center gap-2">
                                            <Calendar className="h-4 w-4 text-[var(--text-muted)]/70" />
                                            {formatDate(sess.start_time)}
                                        </td>
                                        <td className="py-4 text-[var(--text-muted)]">
                                            <span className="flex items-center gap-1.5">
                                                <MapPin className="h-3.5 w-3.5 text-accent/70 flex-shrink-0" />
                                                {locationsMap.get(sess.location_id) || `#${sess.location_id}`}
                                            </span>
                                        </td>
                                        <td className="py-4 font-mono text-xs">{formatTime(sess.start_time)}</td>
                                        <td className="py-4 font-mono text-xs">
                                            {sess.end_time ? (
                                                formatTime(sess.end_time)
                                            ) : (
                                                <span className="text-accent font-semibold flex items-center gap-1">
                                                    <span className="h-2 w-2 rounded-full bg-accent animate-ping" />
                                                    {dict.profile?.tables?.active_session || "En progreso"}
                                                </span>
                                            )}
                                        </td>
                                        <td className="py-4 font-bold">
                                            {sess.end_time ? (
                                                calculateDuration(sess.start_time, sess.end_time)
                                            ) : (
                                                <span className="text-accent font-mono">{activeSessionTime}</span>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )
                ) : (
                    tasks.length === 0 ? (
                        <div className="py-12 text-center text-[var(--text-muted)] text-xs font-semibold">
                            {dict.profile?.tables?.empty_tasks || "No tienes tareas registradas."}
                        </div>
                    ) : (
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="border-b border-[var(--border-soft)] text-2xs uppercase font-bold tracking-wider text-[var(--text-muted)] pb-4">
                                    <th className="pb-4 font-bold">{dict.profile?.tables?.title || "Título"}</th>
                                    <th className="pb-4 font-bold">{dict.profile?.tables?.location || "Ubicación"}</th>
                                    <th className="pb-4 font-bold">{dict.profile?.tables?.price || "Precio"}</th>
                                    <th className="pb-4 font-bold">{dict.profile?.tables?.status || "Estado"}</th>
                                    <th className="pb-4 font-bold">{dict.profile?.tables?.billing || "Facturación"}</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-[var(--border-soft)]/50 text-sm">
                                {tasks.map((task) => (
                                    <tr key={task.id} className="hover:bg-white/[0.01] transition-colors">
                                        <td className="py-4">
                                            <div className="font-semibold">{task.title}</div>
                                            {task.description && (
                                                <div className="text-2xs text-[var(--text-muted)] max-w-md truncate mt-0.5 font-medium">
                                                    {cleanChecklistDescription(task.description)}
                                                </div>
                                            )}
                                        </td>
                                        <td className="py-4 text-[var(--text-muted)]">
                                            <span className="flex items-center gap-1.5">
                                                <MapPin className="h-3.5 w-3.5 text-accent/70 flex-shrink-0" />
                                                {locationsMap.get(task.location_id) || `#${task.location_id}`}
                                            </span>
                                        </td>
                                        <td className="py-4 font-mono text-xs font-semibold">
                                            {task.price != null ? `${task.price.toFixed(2)} €` : "-"}
                                        </td>
                                        <td className="py-4">
                                            <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${
                                                task.status === "completed"
                                                    ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/10"
                                                    : "bg-orange-500/10 text-orange-600 dark:text-orange-400 border border-orange-500/20"
                                            }`}>
                                                <span className={`h-1.5 w-1.5 rounded-full ${task.status === "completed" ? "bg-emerald-500" : "bg-orange-500"}`} />
                                                {task.status === "completed"
                                                    ? (dict.profile?.tables?.status_completed || "Completada")
                                                    : (dict.profile?.tables?.status_pending || "Pendiente")}
                                            </span>
                                        </td>
                                        <td className="py-4">
                                            <span className={`inline-flex px-2.5 py-1 rounded text-xs font-bold ${
                                                task.is_invoiced
                                                    ? "bg-accent/10 text-accent"
                                                    : "bg-[var(--bg-tertiary)] text-[var(--text-muted)]"
                                            }`}>
                                                {task.is_invoiced
                                                    ? (dict.profile?.tables?.invoiced || "Facturado")
                                                    : (dict.profile?.tables?.not_invoiced || "Pendiente")}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )
                )}
            </div>
        </div>
    );
}
