"use client";

import { Briefcase, Calendar, Clock3, MapPin, Users } from "lucide-react";

import { DataListRow, DataListTable } from "@/components/ui/data-list-table";
import { PremiumTabs } from "@/components/ui/premium-tabs";
import { WorkStartLocationLink } from "@/components/work-sessions/WorkStartLocationLink";
import type { Dictionary } from "@/lib/dictionary-context";
import { cleanChecklistDescription } from "@/lib/format";
import { ActiveCompanySession, WorkSession, TaskItem } from "@/types/user";

const formatElapsed = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return [hours, minutes, secs]
        .map((value) => value.toString().padStart(2, "0"))
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

const SESSIONS_GRID =
    "grid-cols-[minmax(8rem,.9fr)_minmax(12rem,1.4fr)_minmax(6rem,.7fr)_minmax(6rem,.7fr)_minmax(6rem,.7fr)]";

const TASKS_GRID =
    "grid-cols-[minmax(12rem,1.5fr)_minmax(10rem,1.1fr)_minmax(6rem,.7fr)_minmax(7rem,.8fr)_minmax(7rem,.8fr)]";

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
        <div className="billing-surface overflow-hidden rounded-[26px]">
            <div className="border-b border-[var(--border-soft)] p-4">
                <PremiumTabs
                    layout="fit"
                    tabs={[
                        { id: "sessions" as const, label: dict.profile?.tabs?.work_history || "Historial de Jornadas" },
                        { id: "tasks" as const, label: dict.profile?.tabs?.task_history || "Historial de Tareas" },
                        ...(canViewActiveTeam
                            ? [{
                                id: "team" as const,
                                label: dict.profile?.tabs?.live_team
                                    ? dict.profile.tabs.live_team.replace("{count}", activeCompanySessions.length.toString())
                                    : `Equipo en vivo (${activeCompanySessions.length})`,
                                icon: Users,
                            }]
                            : [])
                    ]}
                    activeTab={activeTab}
                    onChange={setActiveTab}
                />
            </div>

            <div className="p-3 sm:p-4">
                {activeTab === "team" ? (
                    activeCompanySessions.length === 0 ? (
                        <div className="billing-block rounded-2xl px-5 py-14 text-center">
                            <Users className="mx-auto h-7 w-7 text-[var(--text-muted)]" aria-hidden="true" />
                            <p className="mt-3 text-sm font-semibold text-[var(--text-main)]">
                                {dict.profile?.team?.no_active_workers || "No hay trabajadores con jornada activa"}
                            </p>
                            <p className="mt-1 text-xs font-medium text-[var(--text-muted)]">
                                {dict.profile?.team?.view_updates_automatically || "Esta vista se actualiza automáticamente."}
                            </p>
                        </div>
                    ) : (
                        <div className="grid gap-2.5 md:grid-cols-2">
                            {activeCompanySessions.map((session) => (
                                <DataListRow key={session.id} compact interactive={false}>
                                    <div className="flex items-start justify-between gap-4">
                                        <div className="min-w-0">
                                            <p className="truncate text-sm font-semibold text-[var(--text-main)]">
                                                {session.user_name}
                                            </p>
                                            <p className="truncate text-xs font-medium text-[var(--text-muted)]">
                                                {session.user_email}
                                            </p>
                                        </div>
                                        <span className="flex shrink-0 items-center gap-1.5 rounded-full border border-accent/20 bg-accent/10 px-2.5 py-1 text-xs font-semibold text-accent">
                                            <span className="h-2 w-2 animate-pulse rounded-full bg-accent" />
                                            {formatElapsed(session.elapsed_seconds)}
                                        </span>
                                    </div>
                                    <div className="mt-3 grid gap-2 text-xs font-medium text-[var(--text-muted)]">
                                        <span className="flex items-center gap-2">
                                            <MapPin className="h-4 w-4 text-accent" aria-hidden="true" />
                                            {session.location_name}
                                        </span>
                                        <span className="flex items-center gap-2">
                                            <Clock3 className="h-4 w-4 text-accent" aria-hidden="true" />
                                            {dict.profile?.team?.started_at
                                                ? dict.profile.team.started_at.replace("{time}", formatTime(session.start_time))
                                                : `Jornada iniciada a las ${formatTime(session.start_time)}`}
                                        </span>
                                        <span className="flex items-center gap-2">
                                            <Briefcase className="h-4 w-4 text-accent" aria-hidden="true" />
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
                                </DataListRow>
                            ))}
                        </div>
                    )
                ) : activeTab === "sessions" ? (
                    <DataListTable
                        items={sessions}
                        getRowKey={(session) => session.id}
                        gridClassName={SESSIONS_GRID}
                        variant="plain"
                        columns={[
                            { key: "date", label: dict.profile?.tables?.date || "Fecha" },
                            { key: "location", label: dict.profile?.tables?.location || "Ubicación" },
                            { key: "start", label: dict.profile?.tables?.start_time || "Entrada" },
                            { key: "end", label: dict.profile?.tables?.end_time || "Salida" },
                            { key: "duration", label: dict.profile?.tables?.duration || "Duración" },
                        ]}
                        empty={(
                            <p className="text-xs font-semibold text-[var(--text-muted)]">
                                {dict.profile?.tables?.empty_sessions || "No tienes jornadas registradas."}
                            </p>
                        )}
                        renderCompactRow={(sess) => (
                            <>
                                <div className="flex items-center justify-between gap-3">
                                    <span className="flex items-center gap-2 text-sm font-semibold text-[var(--text-main)]">
                                        <Calendar className="h-4 w-4 text-[var(--text-muted)]" aria-hidden="true" />
                                        {formatDate(sess.start_time)}
                                    </span>
                                    <span className="font-mono text-xs font-semibold text-[var(--text-main)]">
                                        {sess.end_time
                                            ? calculateDuration(sess.start_time, sess.end_time)
                                            : activeSessionTime}
                                    </span>
                                </div>
                                <div className="mt-2.5 space-y-1 border-t border-[var(--border-soft)] pt-2.5 text-xs text-[var(--text-muted)]">
                                    <span className="flex items-center gap-1.5">
                                        <MapPin className="h-3.5 w-3.5 text-accent" aria-hidden="true" />
                                        {locationsMap.get(sess.location_id) || `#${sess.location_id}`}
                                    </span>
                                    <div className="flex justify-between gap-3">
                                        <span>{formatTime(sess.start_time)}</span>
                                        <span>
                                            {sess.end_time
                                                ? formatTime(sess.end_time)
                                                : (dict.profile?.tables?.active_session || "En progreso")}
                                        </span>
                                    </div>
                                </div>
                            </>
                        )}
                        renderDesktopRow={(sess) => (
                            <>
                                <span className="flex items-center gap-2 text-sm font-semibold text-[var(--text-main)]">
                                    <Calendar className="h-4 w-4 text-[var(--text-muted)]" aria-hidden="true" />
                                    {formatDate(sess.start_time)}
                                </span>
                                <span className="flex min-w-0 items-center gap-1.5 text-sm text-[var(--text-muted)]">
                                    <MapPin className="h-3.5 w-3.5 shrink-0 text-accent" aria-hidden="true" />
                                    <span className="truncate">{locationsMap.get(sess.location_id) || `#${sess.location_id}`}</span>
                                </span>
                                <span className="font-mono text-xs text-[var(--text-main)]">{formatTime(sess.start_time)}</span>
                                <span className="font-mono text-xs text-[var(--text-main)]">
                                    {sess.end_time ? (
                                        formatTime(sess.end_time)
                                    ) : (
                                        <span className="font-semibold text-accent">
                                            {dict.profile?.tables?.active_session || "En progreso"}
                                        </span>
                                    )}
                                </span>
                                <span className="text-sm font-semibold text-[var(--text-main)]">
                                    {sess.end_time
                                        ? calculateDuration(sess.start_time, sess.end_time)
                                        : <span className="font-mono text-accent">{activeSessionTime}</span>}
                                </span>
                            </>
                        )}
                    />
                ) : (
                    <DataListTable
                        items={tasks}
                        getRowKey={(task) => task.id}
                        gridClassName={TASKS_GRID}
                        variant="plain"
                        columns={[
                            { key: "title", label: dict.profile?.tables?.title || "Título" },
                            { key: "location", label: dict.profile?.tables?.location || "Ubicación" },
                            { key: "price", label: dict.profile?.tables?.price || "Precio" },
                            { key: "status", label: dict.profile?.tables?.status || "Estado" },
                            { key: "billing", label: dict.profile?.tables?.billing || "Facturación" },
                        ]}
                        empty={(
                            <p className="text-xs font-semibold text-[var(--text-muted)]">
                                {dict.profile?.tables?.empty_tasks || "No tienes tareas registradas."}
                            </p>
                        )}
                        renderCompactRow={(task) => (
                            <>
                                <div className="min-w-0">
                                    <p className="truncate text-sm font-semibold text-[var(--text-main)]">{task.title}</p>
                                    {task.description && (
                                        <p className="mt-0.5 truncate text-[11px] text-[var(--text-muted)]">
                                            {cleanChecklistDescription(task.description)}
                                        </p>
                                    )}
                                </div>
                                <div className="mt-2.5 grid grid-cols-2 gap-2 border-t border-[var(--border-soft)] pt-2.5 text-xs text-[var(--text-muted)]">
                                    <span className="flex min-w-0 items-center gap-1.5">
                                        <MapPin className="h-3.5 w-3.5 shrink-0 text-accent" aria-hidden="true" />
                                        <span className="truncate">{locationsMap.get(task.location_id) || `#${task.location_id}`}</span>
                                    </span>
                                    <span className="text-right font-mono font-semibold text-[var(--text-main)]">
                                        {task.price != null ? `${task.price.toFixed(2)} €` : "-"}
                                    </span>
                                    <span>
                                        {task.status === "completed"
                                            ? (dict.profile?.tables?.status_completed || "Completada")
                                            : (dict.profile?.tables?.status_pending || "Pendiente")}
                                    </span>
                                    <span className="text-right">
                                        {task.is_invoiced
                                            ? (dict.profile?.tables?.invoiced || "Facturado")
                                            : (dict.profile?.tables?.not_invoiced || "Pendiente")}
                                    </span>
                                </div>
                            </>
                        )}
                        renderDesktopRow={(task) => (
                            <>
                                <div className="min-w-0">
                                    <p className="truncate text-sm font-semibold text-[var(--text-main)]">{task.title}</p>
                                    {task.description && (
                                        <p className="mt-0.5 truncate text-[11px] text-[var(--text-muted)]">
                                            {cleanChecklistDescription(task.description)}
                                        </p>
                                    )}
                                </div>
                                <span className="flex min-w-0 items-center gap-1.5 text-sm text-[var(--text-muted)]">
                                    <MapPin className="h-3.5 w-3.5 shrink-0 text-accent" aria-hidden="true" />
                                    <span className="truncate">{locationsMap.get(task.location_id) || `#${task.location_id}`}</span>
                                </span>
                                <span className="font-mono text-xs font-semibold text-[var(--text-main)]">
                                    {task.price != null ? `${task.price.toFixed(2)} €` : "-"}
                                </span>
                                <div>
                                    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-semibold ${
                                        task.status === "completed"
                                            ? "border border-emerald-500/10 bg-emerald-500/10 text-emerald-500"
                                            : "border border-orange-500/20 bg-orange-500/10 text-orange-600"
                                    }`}>
                                        {task.status === "completed"
                                            ? (dict.profile?.tables?.status_completed || "Completada")
                                            : (dict.profile?.tables?.status_pending || "Pendiente")}
                                    </span>
                                </div>
                                <div>
                                    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-semibold ${
                                        task.is_invoiced
                                            ? "bg-accent/10 text-accent"
                                            : "bg-[var(--bg-card-solid)] text-[var(--text-muted)]"
                                    }`}>
                                        {task.is_invoiced
                                            ? (dict.profile?.tables?.invoiced || "Facturado")
                                            : (dict.profile?.tables?.not_invoiced || "Pendiente")}
                                    </span>
                                </div>
                            </>
                        )}
                    />
                )}
            </div>
        </div>
    );
}
