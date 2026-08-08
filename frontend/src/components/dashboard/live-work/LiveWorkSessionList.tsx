"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { Briefcase, Building2, Clock3, MapPin, Users } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
        const emptyTitle = query
            ? (dict.work_sessions?.live_no_results || "No hay fichajes que coincidan con la búsqueda")
            : activeScope === "collaborator"
                ? (dict.work_sessions?.live_empty_collaborator
                    || (locale === "es"
                        ? "No hay colaboradores trabajando en tus reservas ahora mismo"
                        : "No partner workers are active on your reservations"))
                : (dict.work_sessions?.live_empty || "No hay trabajadores fichados ahora mismo");

        const emptyDescription = query
            ? null
            : activeScope === "collaborator"
                ? (dict.work_sessions?.live_empty_collaborator_description
                    || (locale === "es"
                        ? "Cuando un colaborador inicie jornada en una reserva tuya aparecerá aquí."
                        : "Partner workers will appear here when they start a shift on your reservations."))
                : (dict.work_sessions?.live_empty_description
                    || "Cuando un trabajador inicie el cronómetro aparecerá aquí automáticamente.");

        return (
            <div className="billing-block flex flex-col items-center justify-center rounded-2xl border border-dashed border-[var(--border-soft)] px-5 py-10 text-center">
                <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-accent/10 text-accent">
                    <Users className="h-5 w-5" />
                </div>
                <p className="text-sm font-semibold text-[var(--text-main)]">
                    {emptyTitle}
                </p>
                {emptyDescription ? (
                    <p className="mt-1.5 max-w-md text-xs font-medium text-[var(--text-muted)]">
                        {emptyDescription}
                    </p>
                ) : null}
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {sessionsByCompany.map(([companyId, companyGroup]) => (
                <section key={companyId} className="space-y-2.5">
                    <div className="flex items-center justify-between gap-3">
                        <div className="flex min-w-0 items-center gap-2.5">
                            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[var(--bg-card-solid)] text-accent">
                                <Building2 className="h-4 w-4" />
                            </span>
                            <h2 className="truncate text-sm font-bold text-[var(--text-main)]">
                                {companyGroup.companyName}
                            </h2>
                        </div>
                        <Badge
                            variant="secondary"
                            className="shrink-0 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
                        >
                            {companyGroup.sessions.length}{" "}
                            {locale === "es"
                                ? (companyGroup.sessions.length === 1 ? "activo" : "activos")
                                : (companyGroup.sessions.length === 1 ? "active" : "active")}
                        </Badge>
                    </div>

                    <div className="grid gap-2.5 lg:grid-cols-2">
                        {companyGroup.sessions.map(session => {
                            const elapsedSeconds = Math.max(
                                session.elapsed_seconds,
                                Math.floor((now - new Date(session.start_time).getTime()) / 1000)
                            );
                            const startTime = new Date(session.start_time).toLocaleTimeString(
                                locale === "es" ? "es-ES" : "en-US",
                                { hour: "2-digit", minute: "2-digit", timeZone: "UTC" },
                            );
                            const hasStartPoint = session.start_latitude !== null
                                && session.start_latitude !== undefined
                                && session.start_longitude !== null
                                && session.start_longitude !== undefined;

                            return (
                                <article
                                    key={session.id}
                                    className="billing-block flex flex-col justify-between overflow-hidden rounded-2xl border border-[var(--border-soft)] p-4 transition-[border-color,box-shadow] duration-200 hover:border-accent/30 hover:shadow-[0_8px_20px_rgba(52,74,94,0.08)]"
                                >
                                    <div className="space-y-3">
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="min-w-0">
                                                <div className="flex items-center gap-2">
                                                    <span
                                                        className="h-2 w-2 shrink-0 animate-pulse rounded-full bg-accent"
                                                        aria-hidden="true"
                                                    />
                                                    <h3 className="truncate text-sm font-bold text-[var(--text-main)]">
                                                        {session.user_name}
                                                    </h3>
                                                </div>
                                                <p className="mt-0.5 truncate text-[11px] font-medium text-[var(--text-muted)]">
                                                    {session.user_email}
                                                </p>
                                            </div>
                                            <Badge
                                                variant="secondary"
                                                className="shrink-0 border-accent/20 bg-accent/10 px-2.5 py-1 font-mono text-xs font-bold tabular-nums text-accent"
                                            >
                                                {formatElapsed(elapsedSeconds)}
                                            </Badge>
                                        </div>

                                        <div className="grid grid-cols-1 divide-y divide-[var(--border-soft)] overflow-hidden rounded-xl border border-[var(--border-soft)] bg-[var(--bg-secondary)]/40 sm:grid-cols-3 sm:divide-x sm:divide-y-0">
                                            <MetaCell
                                                icon={<Briefcase className="h-3 w-3" />}
                                                label={dict.work_sessions?.live_task_label || "Tarea"}
                                                value={session.task_title || dict.profile?.team?.general_shift || "—"}
                                            />
                                            <MetaCell
                                                icon={<MapPin className="h-3 w-3" />}
                                                label={dict.work_sessions?.live_location_label || "Ubicación"}
                                                value={session.location_name}
                                            />
                                            <MetaCell
                                                icon={<Clock3 className="h-3 w-3" />}
                                                label={dict.work_sessions?.live_started_label || "Inicio"}
                                                value={startTime}
                                            />
                                        </div>
                                    </div>

                                    {(hasStartPoint || session.task_item_id) && (
                                        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-[var(--border-soft)] pt-3">
                                            {hasStartPoint && (
                                                <WorkStartLocationLink
                                                    latitude={session.start_latitude!}
                                                    longitude={session.start_longitude!}
                                                    accuracyMeters={session.start_accuracy_meters}
                                                    label={dict.work_sessions?.live_open_map || "Ver punto de inicio"}
                                                    className="text-xs"
                                                />
                                            )}
                                            {session.task_item_id && (
                                                <Button
                                                    asChild
                                                    variant="outline"
                                                    size="xs"
                                                    className="ml-auto"
                                                >
                                                    <Link href="/dashboard/tasks">
                                                        {dict.work_sessions?.live_open_task || "Abrir tarea"}
                                                    </Link>
                                                </Button>
                                            )}
                                        </div>
                                    )}
                                </article>
                            );
                        })}
                    </div>
                </section>
            ))}
        </div>
    );
}

function MetaCell({
    icon,
    label,
    value,
}: {
    icon: ReactNode;
    label: string;
    value: string;
}) {
    return (
        <div className="px-3 py-2.5">
            <span className="flex items-center gap-1 text-[9px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                <span className="text-accent" aria-hidden="true">{icon}</span>
                {label}
            </span>
            <span className="mt-0.5 block truncate text-[11px] font-semibold text-[var(--text-main)]">
                {value}
            </span>
        </div>
    );
}
