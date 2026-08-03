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
            className="surface-glass-card flex min-h-[250px] cursor-pointer flex-col justify-between rounded-2xl p-5 transition-colors duration-200 hover:border-[var(--btn-secondary-border)]"
        >
            <div className="space-y-4">
                <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 space-y-2">
                        <span className="inline-flex max-w-full items-center gap-1.5 truncate rounded-lg border border-[var(--border-soft)] bg-[var(--bg-secondary)] px-2.5 py-1 text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
                            <MapPin className="h-3.5 w-3.5 shrink-0 text-accent" />
                            {getLocationName(task.location_id)}
                        </span>
                        {issuerName && (
                            <p className="flex items-center gap-1.5 text-sm font-semibold text-[var(--text-muted)]">
                                <Building2 className="h-4 w-4 text-accent" />
                                Emisora: {issuerName}
                            </p>
                        )}
                    </div>
                    <span className="text-xs bg-[var(--btn-secondary-bg)] text-[var(--btn-secondary-text)] border border-[var(--btn-secondary-border)] px-2 py-1 rounded-lg font-black tracking-wide uppercase">
                        Solicitud
                    </span>
                </div>

                <div>
                    <h3 className="text-base font-black text-[var(--text-main)]">
                        {task.title}
                    </h3>
                    {location && (
                        <p className="mt-1.5 flex items-center gap-1.5 text-sm font-medium text-[var(--text-muted)]">
                            {location.address}, {location.city}
                        </p>
                    )}
                </div>

                <div className="grid grid-cols-1 gap-px overflow-hidden rounded-xl border border-[var(--border-soft)] bg-[var(--border-soft)] sm:grid-cols-3">
                    {reservation && (
                        <div>
                            <div className="h-full bg-[var(--bg-secondary)] p-3">
                            <span className="block text-xs font-bold text-[var(--text-muted)]">Salida actual</span>
                            <p className="mt-1 text-sm font-black text-[var(--text-main)]">
                                {new Date(reservation.check_out_at).toLocaleString("es-ES", {
                                    month: "short",
                                    day: "numeric",
                                    hour: "2-digit",
                                    minute: "2-digit",
                                    timeZone: "UTC",
                                })}
                            </p>
                            </div>
                        </div>
                    )}
                    <div className="bg-[var(--bg-secondary)] p-3">
                        <span className="flex items-center gap-1.5 text-xs font-bold text-[var(--text-muted)]">
                            <CalendarClock className="h-3.5 w-3.5 text-accent" />
                            Fecha propuesta
                        </span>
                        <p className="mt-1 text-sm font-black text-[var(--text-main)]">
                            {plannedAt ? new Date(plannedAt).toLocaleString("es-ES", {
                                month: "short",
                                day: "numeric",
                                timeZone: "UTC",
                            }) : "Sin fecha"}
                        </p>
                    </div>
                    <div className="bg-[var(--bg-secondary)] p-3">
                        <span className="block text-xs font-bold text-[var(--text-muted)]">Próxima entrada</span>
                        <p className="mt-1 text-sm font-black text-[var(--text-main)]">
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

                {reservation && (
                    <div className="flex flex-wrap gap-4 text-sm font-semibold text-[var(--text-muted)]">
                        <span className="flex items-center gap-1.5">
                            <Users className="h-4 w-4 text-accent" />
                            {reservation.guest_count} huéspedes
                        </span>
                        {task.next_reservation && (
                            <span>
                                Próximos: {task.next_reservation.guest_count} huéspedes
                            </span>
                        )}
                    </div>
                )}

                {task.description && (
                    <div className="rounded-xl border border-[var(--border-soft)] bg-[var(--bg-secondary)] p-3">
                        <InstructionList
                            description={task.description}
                            showSummary={false}
                            maxItems={3}
                        />
                    </div>
                )}
                {reservation?.notes && (
                    <div className="rounded-xl border border-orange-500/25 bg-orange-500/[0.07] p-3">
                        <p className="text-xs font-black uppercase tracking-wider text-orange-700 dark:text-orange-300">
                            Indicaciones de la emisora
                        </p>
                        <p className="mt-1.5 text-sm font-medium leading-6 text-[var(--text-main)]">
                            {reservation.notes}
                        </p>
                    </div>
                )}
            </div>

            <div className="flex justify-end gap-2.5 pt-4 mt-4 border-t border-[var(--border-soft)]/50">
                <Button
                    variant="outline"
                    size="sm"
                    disabled={isWorking}
                    onClick={(e) => {
                        e.stopPropagation();
                        onReject(task.id);
                    }}
                    className="gap-1.5 rounded-xl border-[var(--btn-cancel-border)] bg-[var(--btn-cancel-bg)] hover:bg-[var(--btn-cancel-hover-bg)] hover:text-[var(--btn-cancel-hover-text)] text-[var(--btn-cancel-text)] h-9 text-xs font-black uppercase tracking-wider cursor-pointer"
                >
                    <X className="w-3.5 h-3.5" /> Rechazar
                </Button>
                <Button
                    size="sm"
                    onClick={(e) => {
                        e.stopPropagation();
                        onAccept(task);
                    }}
                    className="gap-1.5 rounded-xl bg-[var(--btn-primary-bg)] hover:bg-[var(--btn-primary-hover-bg)] text-[var(--btn-primary-text)] h-9 text-xs font-black uppercase tracking-wider cursor-pointer"
                >
                    <Check className="w-3.5 h-3.5 stroke-[3px]" />
                    Aceptar
                </Button>
            </div>
        </div>
    );
}
