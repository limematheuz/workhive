"use client";

import {
    Building2,
    CalendarClock,
    Check,
    MapPin,
    Users,
    X,
} from "lucide-react";
import { TaskItem } from "@/services/task.service";
import { Location } from "@/services/location.service";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { InstructionList } from "@/components/ui/instruction-list";

interface TaskRequestCardProps {
    task: TaskItem;
    location: Location | undefined;
    getLocationName: (locId: number) => string;
    isWorking: boolean;
    onAccept: (task: TaskItem) => void;
    onReject: (taskId: number) => void;
}

export function TaskRequestCard({
    task,
    location,
    getLocationName,
    isWorking,
    onAccept,
    onReject,
}: TaskRequestCardProps) {
    const reservation = task.checkout_reservation;
    const issuerName = reservation?.owner_company_name;
    const plannedAt = task.scheduled_start_at || reservation?.check_out_at;

    return (
        <div
            role="button"
            tabIndex={0}
            aria-label={task.title}
            onClick={() => onAccept(task)}
            onKeyDown={(event) => {
                if (event.target !== event.currentTarget) return;
                if (event.key === "Enter" || event.key === " ") {
                    if (event.key === " ") event.preventDefault();
                    onAccept(task);
                }
            }}
            className="billing-block flex min-h-[230px] cursor-pointer flex-col justify-between overflow-hidden rounded-2xl border border-[var(--border-soft)] p-4 transition-[border-color,box-shadow] duration-200 hover:border-accent/30 hover:shadow-[0_8px_20px_rgba(52,74,94,0.08)]"
        >
            <div className="space-y-3">
                <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 space-y-1.5">
                        <span className="inline-flex max-w-full items-center gap-1.5 truncate rounded-lg border border-[var(--border-soft)] bg-[var(--bg-secondary)]/50 px-2 py-1 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                            <MapPin className="h-3.5 w-3.5 shrink-0 text-accent" />
                            {getLocationName(task.location_id)}
                        </span>
                        {issuerName ? (
                            <p className="flex items-center gap-1.5 text-xs font-medium text-[var(--text-muted)]">
                                <Building2 className="h-3.5 w-3.5 text-accent" />
                                Emisora: {issuerName}
                            </p>
                        ) : null}
                    </div>
                    <Badge
                        variant="secondary"
                        className="shrink-0 border-accent/20 bg-accent/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-accent"
                    >
                        Solicitud
                    </Badge>
                </div>

                <div>
                    <h3 className="text-base font-bold text-[var(--text-main)]">
                        {task.title}
                    </h3>
                    {location ? (
                        <p className="mt-1 text-[11px] font-medium text-[var(--text-muted)]">
                            {location.address}, {location.city}
                        </p>
                    ) : null}
                </div>

                <div className="grid grid-cols-1 divide-y divide-[var(--border-soft)] overflow-hidden rounded-xl border border-[var(--border-soft)] bg-[var(--bg-secondary)]/40 sm:grid-cols-3 sm:divide-x sm:divide-y-0">
                    {reservation ? (
                        <div className="px-3 py-2.5">
                            <span className="block text-[9px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                                Salida actual
                            </span>
                            <p className="mt-0.5 text-[11px] font-semibold text-[var(--text-main)]">
                                {new Date(reservation.check_out_at).toLocaleString("es-ES", {
                                    month: "short",
                                    day: "numeric",
                                    hour: "2-digit",
                                    minute: "2-digit",
                                    timeZone: "UTC",
                                })}
                            </p>
                        </div>
                    ) : null}
                    <div className="px-3 py-2.5">
                        <span className="flex items-center gap-1 text-[9px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                            <CalendarClock className="h-3 w-3 text-accent" />
                            Fecha propuesta
                        </span>
                        <p className="mt-0.5 text-[11px] font-semibold text-[var(--text-main)]">
                            {plannedAt ? new Date(plannedAt).toLocaleString("es-ES", {
                                month: "short",
                                day: "numeric",
                                timeZone: "UTC",
                            }) : "Sin fecha"}
                        </p>
                    </div>
                    <div className="px-3 py-2.5">
                        <span className="block text-[9px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                            Próxima entrada
                        </span>
                        <p className="mt-0.5 text-[11px] font-semibold text-[var(--text-main)]">
                            {task.next_reservation
                                ? new Date(task.next_reservation.check_in_at).toLocaleString("es-ES", {
                                    month: "short",
                                    day: "numeric",
                                    hour: "2-digit",
                                    minute: "2-digit",
                                    timeZone: "UTC",
                                })
                                : "Sin próxima entrada"}
                        </p>
                    </div>
                </div>

                {reservation ? (
                    <div className="flex flex-wrap gap-3 text-xs font-medium text-[var(--text-muted)]">
                        <span className="flex items-center gap-1.5">
                            <Users className="h-3.5 w-3.5 text-accent" />
                            {reservation.guest_count} huéspedes
                        </span>
                        {task.next_reservation ? (
                            <span>
                                Próximos: {task.next_reservation.guest_count} huéspedes
                            </span>
                        ) : null}
                    </div>
                ) : null}

                {task.description ? (
                    <div className="rounded-xl border border-[var(--border-soft)] bg-[var(--bg-secondary)]/30 p-2.5">
                        <InstructionList
                            description={task.description}
                            showSummary={false}
                            maxItems={3}
                        />
                    </div>
                ) : null}
                {reservation?.notes ? (
                    <div className="rounded-xl border border-orange-500/20 bg-orange-500/[0.06] p-2.5">
                        <p className="text-[9px] font-semibold uppercase tracking-wider text-orange-700 dark:text-orange-300">
                            Indicaciones de la emisora
                        </p>
                        <p className="mt-1 text-xs font-medium leading-5 text-[var(--text-main)]">
                            {reservation.notes}
                        </p>
                    </div>
                ) : null}
            </div>

            <div className="mt-3 flex justify-end gap-2 border-t border-[var(--border-soft)] pt-3">
                <Button
                    variant="dangerSoft"
                    size="xs"
                    disabled={isWorking}
                    onClick={(e) => {
                        e.stopPropagation();
                        onReject(task.id);
                    }}
                >
                    <X className="h-3.5 w-3.5" /> Rechazar
                </Button>
                <Button
                    size="xs"
                    disabled={isWorking}
                    onClick={(e) => {
                        e.stopPropagation();
                        onAccept(task);
                    }}
                >
                    <Check className="h-3.5 w-3.5 stroke-[3px]" />
                    Aceptar
                </Button>
            </div>
        </div>
    );
}
