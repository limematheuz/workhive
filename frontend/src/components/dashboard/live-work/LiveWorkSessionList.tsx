"use client";

import Link from "next/link";
import { Briefcase, Building2, Clock3, MapPin, Users } from "lucide-react";

import { BrandIconWell } from "@/components/ui/brand-icon-well";
import { WorkStartLocationLink } from "@/components/work-sessions/WorkStartLocationLink";
import { useDictionary } from "@/lib/dictionary-context";
import type { ActiveCompanySession } from "@/types/user";

function formatElapsed(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainingSeconds = seconds % 60;
    return [hours, minutes, remainingSeconds]
        .map(value => value.toString().padStart(2, "0"))
        .join(":");
}

type CompanyGroup = {
    companyName: string;
    sessions: ActiveCompanySession[];
};

type LiveWorkSessionListProps = {
    query: string;
    activeScope: "own" | "collaborator";
    sessionsByCompany: [number, CompanyGroup][];
    visibleCount: number;
    now: number;
};

export function LiveWorkSessionList({
    query,
    activeScope,
    sessionsByCompany,
    visibleCount,
    now,
}: LiveWorkSessionListProps) {
    const { dict, locale } = useDictionary();

    if (visibleCount === 0) {
        return (
            <div className="surface-glass-card rounded-3xl border-dashed px-6 py-16 text-center">
                <Users className="mx-auto h-9 w-9 text-[var(--text-muted)]" />
                <h2 className="mt-4 text-lg font-black text-[var(--text-main)]">
                    {query
                        ? (dict.work_sessions?.live_no_results || "No hay fichajes que coincidan con la búsqueda")
                        : activeScope === "collaborator"
                            ? (locale === "es"
                                ? "No hay colaboradores trabajando en tus reservas ahora mismo"
                                : "No partner workers are active on your reservations")
                            : (dict.work_sessions?.live_empty || "No hay trabajadores fichados ahora mismo")}
                </h2>
                <p className="mt-2 text-sm font-medium text-[var(--text-muted)]">
                    {dict.work_sessions?.live_empty_description
                    || "Cuando un trabajador inicie el cronómetro aparecerá aquí automáticamente."}
                </p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {sessionsByCompany.map(([companyId, companyGroup]) => (
                <section key={companyId} className="space-y-3">
                    <div className="flex items-center justify-between gap-4">
                        <div className="flex min-w-0 items-center gap-3">
                            <BrandIconWell icon={Building2} size="sm" />
                            <h2 className="truncate text-lg font-black text-[var(--text-main)]">
                                {companyGroup.companyName}
                            </h2>
                        </div>
                        <span className="shrink-0 rounded-full border border-[var(--border-soft)] bg-[var(--bg-card)] px-3 py-1 text-xs font-black text-[var(--text-muted)]">
                            {companyGroup.sessions.length} {locale === "es"
                                ? (companyGroup.sessions.length === 1 ? "activo" : "activos")
                                : (companyGroup.sessions.length === 1 ? "active" : "active")}
                        </span>
                    </div>
                    <div className="grid gap-4 lg:grid-cols-2">
                        {companyGroup.sessions.map(session => {
                            const elapsedSeconds = Math.max(
                                session.elapsed_seconds,
                                Math.floor((now - new Date(session.start_time).getTime()) / 1000)
                            );
                            const startTime = new Date(session.start_time).toLocaleTimeString(
                                locale === "es" ? "es-ES" : "en-US",
                                { hour: "2-digit", minute: "2-digit", timeZone: "UTC" },
                            );

                            return (
                                <article
                                    key={session.id}
                                    className="surface-glass-card rounded-3xl p-5"
                                >
                                    <div className="flex items-start justify-between gap-4">
                                        <div className="min-w-0">
                                            <div className="flex items-center gap-2">
                                                <span className="h-2.5 w-2.5 shrink-0 animate-pulse rounded-full bg-emerald-500" />
                                                <h2 className="truncate text-base font-black text-[var(--text-main)]">
                                                    {session.user_name}
                                                </h2>
                                            </div>
                                            <p className="mt-1 truncate text-xs font-medium text-[var(--text-muted)]">
                                                {session.user_email}
                                            </p>
                                        </div>
                                        <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1.5 font-mono text-sm font-black text-emerald-600">
                                            {formatElapsed(elapsedSeconds)}
                                        </span>
                                    </div>

                                    <div className="mt-5 grid gap-3 text-sm font-semibold text-[var(--text-muted)]">
                                        <div className="flex items-start gap-3">
                                            <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
                                            <span>{session.location_name}</span>
                                        </div>
                                        <div className="flex items-start gap-3">
                                            <Clock3 className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
                                            <span>
                                                {(dict.work_sessions?.live_started_at || "Empezó a las {time}")
                                                    .replace("{time}", startTime)}
                                            </span>
                                        </div>
                                        <div className="flex items-start gap-3">
                                            <Briefcase className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
                                            <span>{session.task_title || dict.profile?.team?.general_shift}</span>
                                        </div>
                                    </div>

                                    <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-[var(--border-soft)] pt-4">
                                        {session.start_latitude !== null
                                            && session.start_latitude !== undefined
                                            && session.start_longitude !== null
                                            && session.start_longitude !== undefined && (
                                            <WorkStartLocationLink
                                                latitude={session.start_latitude}
                                                longitude={session.start_longitude}
                                                accuracyMeters={session.start_accuracy_meters}
                                                label={dict.work_sessions?.live_open_map || "Ver punto de inicio"}
                                            />
                                        )}
                                        {session.task_item_id && (
                                            <Link
                                                href="/dashboard/tasks"
                                                className="text-xs font-black text-accent hover:underline"
                                            >
                                                {dict.work_sessions?.live_open_task || "Abrir tarea"}
                                            </Link>
                                        )}
                                    </div>
                                </article>
                            );
                        })}
                    </div>
                </section>
            ))}
        </div>
    );
}
