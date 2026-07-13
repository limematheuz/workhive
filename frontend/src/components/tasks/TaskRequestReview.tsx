import {
    ArrowRight,
    Calendar,
    Check,
    ClipboardCheck,
    Loader2,
    MapPin,
    Users,
    X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { InstructionList } from "@/components/ui/instruction-list";
import { buildLocalDateTimeIso } from "@/lib/format";
import type { Location } from "@/services/location.service";
import type { TaskItem } from "@/services/task.service";
import { getDefaultTaskDate } from "@/domain/tasks/task-create";
import { toTaskPlanningDateInput } from "@/domain/tasks/task-schedule";

interface TaskRequestReviewProps {
    task: TaskItem;
    location?: Location;
    isAdminOrManager: boolean;
    isSaving: boolean;
    description: string;
    planningDate: string;
    planningTime: string;
    maxPlanningDate?: string;
    assigneeName: string;
    onPlanningDateChange: (value: string) => void;
    onPlanningTimeChange: (value: string) => void;
    onAccept?: (taskId: number, scheduledStartAt?: string) => Promise<void> | void;
    onReject?: (taskId: number) => Promise<void> | void;
    onClose: () => void;
}

const REQUEST_DATE_TIME_FORMATTER = new Intl.DateTimeFormat("es-ES", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
});

const REQUEST_CURRENCY_FORMATTER = new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: "EUR",
});

function formatDateTime(value?: string | null) {
    if (!value) return "Sin fecha";
    return REQUEST_DATE_TIME_FORMATTER.format(new Date(value));
}

export function TaskRequestReview({
    task,
    location,
    isAdminOrManager,
    isSaving,
    description,
    planningDate,
    planningTime,
    maxPlanningDate,
    assigneeName,
    onPlanningDateChange,
    onPlanningTimeChange,
    onAccept,
    onReject,
    onClose,
}: TaskRequestReviewProps) {
    const today = getDefaultTaskDate();
    const checkoutDate = toTaskPlanningDateInput(
        task.checkout_reservation?.check_out_at,
    );
    const minPlanningDate = checkoutDate > today ? checkoutDate : today;
    const priorityLabel =
        task.priority === "high"
            ? "Alta"
            : task.priority === "low"
              ? "Baja"
              : "Media";

    return (
        <div className="flex min-h-0 flex-1 flex-col font-sans">
            <div className="flex-1 overflow-y-auto px-6 py-5">
                <div className="flex items-start gap-3 rounded-2xl border border-[var(--btn-secondary-border)] bg-[var(--btn-secondary-bg)] p-4">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--bg-card-solid)] text-accent shadow-sm">
                        <ClipboardCheck className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                        <p className="text-sm font-black text-[var(--text-main)]">
                            Pendiente de respuesta
                        </p>
                        <p className="mt-1 text-sm font-medium leading-relaxed text-[var(--text-muted)]">
                            La empresa emisora solicita este servicio. Al aceptar
                            se incorporará a tu planificación como tarea.
                        </p>
                    </div>
                </div>

                <section className="grid grid-cols-1 gap-6 border-b border-[var(--border-soft)] py-6 sm:grid-cols-2">
                    <div className="flex items-start gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--btn-secondary-bg)] text-accent">
                            <MapPin className="h-5 w-5" />
                        </div>
                        <div className="min-w-0">
                            <span className="text-xs font-black uppercase tracking-wider text-[var(--text-muted)]">
                                Propiedad
                            </span>
                            <p className="mt-1 text-base font-black text-[var(--text-main)]">
                                {location?.name || "Ubicación sin nombre"}
                            </p>
                            {(location?.address || location?.city) && (
                                <p className="mt-1 text-sm font-medium leading-relaxed text-[var(--text-muted)]">
                                    {[location?.address, location?.city]
                                        .filter(Boolean)
                                        .join(", ")}
                                </p>
                            )}
                        </div>
                    </div>
                    <div className="flex items-start gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--btn-secondary-bg)] text-accent">
                            <Calendar className="h-5 w-5" />
                        </div>
                        <div className="min-w-0 flex-1">
                            <label
                                htmlFor="request-planning-date"
                                className="text-xs font-black uppercase tracking-wider text-[var(--text-muted)]"
                            >
                                Fecha propuesta de limpieza
                            </label>
                            <div className="mt-2 grid grid-cols-[minmax(0,1fr)_7.5rem] gap-2">
                                <input
                                    id="request-planning-date"
                                    type="date"
                                    value={planningDate}
                                    min={minPlanningDate}
                                    max={maxPlanningDate}
                                    onChange={(event) =>
                                        onPlanningDateChange(event.target.value)
                                    }
                                    className="min-w-0 rounded-xl border border-[var(--border-color)] bg-[var(--bg-tertiary)] px-3 py-2.5 text-sm font-bold text-[var(--text-main)] outline-none transition-colors focus:border-accent"
                                />
                                <input
                                    aria-label="Hora propuesta de limpieza"
                                    type="time"
                                    value={planningTime}
                                    onChange={(event) =>
                                        onPlanningTimeChange(event.target.value)
                                    }
                                    className="min-w-0 rounded-xl border border-[var(--border-color)] bg-[var(--bg-tertiary)] px-3 py-2.5 text-sm font-bold text-[var(--text-main)] outline-none transition-colors focus:border-accent"
                                />
                            </div>
                            <p className="mt-2 text-sm font-medium leading-relaxed text-[var(--text-muted)]">
                                La emisora propone esta fecha. Puedes ajustarla
                                antes de aceptar
                                {maxPlanningDate
                                    ? ", siempre antes de la próxima entrada."
                                    : "."}
                            </p>
                        </div>
                    </div>
                </section>

                <section className="border-b border-[var(--border-soft)] py-6">
                    <h3 className="text-xs font-black uppercase tracking-wider text-accent">
                        Datos del servicio
                    </h3>
                    <div className="mt-3 grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-[var(--border-soft)] bg-[var(--border-soft)] sm:grid-cols-4">
                        {[
                            ["Prioridad", priorityLabel],
                            ["Asignación", assigneeName],
                            [
                                "Cantidad",
                                `${task.quantity ?? 1} ${task.unit || "unidad"}`,
                            ],
                            [
                                "Importe",
                                task.price !== null &&
                                task.price !== undefined
                                    ? REQUEST_CURRENCY_FORMATTER.format(task.price)
                                    : "No indicado",
                            ],
                        ].map(([label, value]) => (
                            <div
                                key={label}
                                className="min-w-0 bg-[var(--bg-secondary)] px-4 py-3"
                            >
                                <span className="text-xs font-semibold text-[var(--text-muted)]">
                                    {label}
                                </span>
                                <p className="mt-1 truncate text-sm font-black text-[var(--text-main)]">
                                    {value}
                                </p>
                            </div>
                        ))}
                    </div>
                </section>

                {(task.checkout_reservation || task.next_reservation) && (
                    <section className="border-b border-[var(--border-soft)] py-6">
                        <h3 className="text-xs font-black uppercase tracking-wider text-accent">
                            Contexto de la reserva
                        </h3>
                        <div className="mt-3 grid grid-cols-[1fr_auto_1fr] items-center gap-3 rounded-2xl border border-[var(--border-soft)] bg-[var(--bg-secondary)] p-4">
                            <div className="min-w-0">
                                <span className="text-xs font-semibold text-[var(--text-muted)]">
                                    Salida actual
                                </span>
                                <p className="mt-1 text-sm font-black leading-relaxed text-[var(--text-main)]">
                                    {task.checkout_reservation
                                        ? formatDateTime(
                                              task.checkout_reservation
                                                  .check_out_at
                                          )
                                        : "Sin salida vinculada"}
                                </p>
                                {task.checkout_reservation && (
                                    <p className="mt-1 flex items-center gap-1.5 text-sm font-semibold text-[var(--text-muted)]">
                                        <Users className="h-4 w-4 text-accent" />
                                        {
                                            task.checkout_reservation
                                                .guest_count
                                        }{" "}
                                        huéspedes
                                    </p>
                                )}
                            </div>
                            <div className="flex h-8 w-8 items-center justify-center rounded-full border border-[var(--btn-secondary-border)] bg-[var(--btn-secondary-bg)] text-accent">
                                <ArrowRight className="h-4 w-4" />
                            </div>
                            <div className="min-w-0 text-right">
                                <span className="text-xs font-semibold text-[var(--text-muted)]">
                                    Próxima entrada
                                </span>
                                <p className="mt-1 text-sm font-black leading-relaxed text-[var(--text-main)]">
                                    {task.next_reservation
                                        ? formatDateTime(
                                              task.next_reservation.check_in_at
                                          )
                                        : "No entra ningún huésped"}
                                </p>
                                {task.next_reservation && (
                                    <p className="mt-1 flex items-center justify-end gap-1.5 text-sm font-semibold text-[var(--text-muted)]">
                                        <Users className="h-4 w-4 text-accent" />
                                        {task.next_reservation.guest_count}{" "}
                                        huéspedes
                                    </p>
                                )}
                            </div>
                        </div>
                    </section>
                )}

                {task.checkout_reservation?.notes && (
                    <section className="border-b border-[var(--border-soft)] py-6">
                        <h3 className="text-xs font-black uppercase tracking-wider text-accent">
                            Indicaciones de la empresa emisora
                        </h3>
                        <div className="mt-3 rounded-2xl border border-orange-500/25 bg-orange-500/[0.07] p-4">
                            <p className="text-sm font-medium leading-6 text-[var(--text-main)]">
                                {task.checkout_reservation.notes}
                            </p>
                        </div>
                    </section>
                )}

                <section className="pt-6">
                    <h3 className="text-xs font-black uppercase tracking-wider text-accent">
                        Descripción e instrucciones
                    </h3>
                    <InstructionList
                        description={description}
                        emptyText="No se han añadido instrucciones para este servicio."
                        className="mt-3"
                    />
                </section>
            </div>

            {isAdminOrManager && (
                <div className="flex justify-end gap-2.5 border-t border-[var(--border-soft)] bg-[var(--bg-card-solid)] px-6 py-4">
                    <Button
                        type="button"
                        disabled={isSaving}
                        onClick={async () => {
                            if (onReject) {
                                await onReject(task.id);
                                onClose();
                            }
                        }}
                        className="flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-xl border border-[var(--btn-cancel-border)] bg-[var(--btn-cancel-bg)] px-5 py-2.5 text-sm font-bold text-[var(--btn-cancel-text)] transition-all hover:bg-[var(--btn-cancel-hover-bg)] hover:text-[var(--btn-cancel-hover-text)] active:scale-[0.98] sm:flex-none"
                    >
                        <X className="h-4 w-4" />
                        Rechazar
                    </Button>
                    <Button
                        type="button"
                        disabled={isSaving}
                        onClick={async () => {
                            if (onAccept) {
                                await onAccept(
                                    task.id,
                                    buildLocalDateTimeIso(
                                        planningDate,
                                        planningTime
                                    ) || undefined
                                );
                                onClose();
                            }
                        }}
                        className="flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-xl border border-[var(--border-soft)] bg-[var(--btn-primary-bg)] px-5 py-2.5 text-sm font-bold text-[var(--btn-primary-text)] transition-all hover:bg-[var(--btn-primary-hover-bg)] active:scale-[0.98] sm:flex-none"
                    >
                        {isSaving ? (
                            <>
                                <Loader2 className="h-4 w-4 animate-spin" />
                                Procesando...
                            </>
                        ) : (
                            <>
                                <Check className="h-4 w-4 stroke-[3px]" />
                                Aceptar
                            </>
                        )}
                    </Button>
                </div>
            )}
        </div>
    );
}
