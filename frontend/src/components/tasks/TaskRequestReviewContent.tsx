import { ArrowRight, Calendar, ClipboardCheck, MapPin, Users } from "lucide-react";

import { InstructionList } from "@/components/ui/instruction-list";
import { DatePicker } from "@/components/ui/date-picker";
import { Input } from "@/components/ui/input";
import type { TaskPricingEditValues } from "@/lib/task-pricing";
import type { Dictionary } from "@/lib/dictionary-context";
import type { Location } from "@/services/location.service";
import type { TaskItem } from "@/services/task.service";
import type { TaskPricingMode } from "@/domain/tasks/task-edit";

import { TaskPricingAgreementSection } from "./TaskEditPricingSection";

interface TaskRequestReviewContentProps {
    dict: Dictionary;
    task: TaskItem;
    location?: Location;
    description: string;
    planningDate: string;
    planningTime: string;
    maxPlanningDate?: string;
    minPlanningDate: string;
    assigneeName: string;
    priorityLabel: string;
    pricing: TaskPricingEditValues;
    managerEditable: boolean;
    onPlanningDateChange: (value: string) => void;
    onPlanningTimeChange: (value: string) => void;
    onPriceChange: (value: string) => void;
    onPricingModeChange: (value: TaskPricingMode) => void;
    onQuantityChange: (value: string) => void;
    onUnitChange: (value: string) => void;
}

const REQUEST_DATE_TIME_FORMATTER = new Intl.DateTimeFormat("es-ES", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Madrid",
});

const REQUEST_CURRENCY_FORMATTER = new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: "EUR",
});

function formatDateTime(value?: string | null) {
    return value ? REQUEST_DATE_TIME_FORMATTER.format(new Date(value)) : "Sin fecha";
}

export function TaskRequestReviewContent({
    dict,
    task,
    location,
    description,
    planningDate,
    planningTime,
    maxPlanningDate,
    minPlanningDate,
    assigneeName,
    priorityLabel,
    pricing,
    managerEditable,
    onPlanningDateChange,
    onPlanningTimeChange,
    onPriceChange,
    onPricingModeChange,
    onQuantityChange,
    onUnitChange,
}: TaskRequestReviewContentProps) {
    return (
        <div className="flex-1 overflow-y-auto px-6 py-5">
            <div className="flex items-start gap-3 rounded-2xl border border-[var(--btn-secondary-border)] bg-[var(--btn-secondary-bg)] p-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--bg-card-solid)] text-accent shadow-sm">
                    <ClipboardCheck className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                    <p className="text-sm font-black text-[var(--text-main)]">Pendiente de respuesta</p>
                    <p className="mt-1 text-sm font-medium leading-relaxed text-[var(--text-muted)]">
                        La empresa emisora solicita este servicio. Al aceptar se incorporará a tu planificación como tarea.
                    </p>
                </div>
            </div>

            <section className="grid grid-cols-1 gap-6 border-b border-[var(--border-soft)] py-6 sm:grid-cols-2">
                <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--btn-secondary-bg)] text-accent"><MapPin className="h-5 w-5" /></div>
                    <div className="min-w-0">
                        <span className="text-xs font-black uppercase tracking-wider text-[var(--text-muted)]">Propiedad</span>
                        <p className="mt-1 text-base font-black text-[var(--text-main)]">{location?.name || "Ubicación sin nombre"}</p>
                        {(location?.address || location?.city) && (
                            <p className="mt-1 text-sm font-medium leading-relaxed text-[var(--text-muted)]">
                                {[location.address, location.city].filter(Boolean).join(", ")}
                            </p>
                        )}
                    </div>
                </div>
                <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--btn-secondary-bg)] text-accent"><Calendar className="h-5 w-5" /></div>
                    <div className="min-w-0 flex-1">
                        <label htmlFor="request-planning-date" className="text-xs font-black uppercase tracking-wider text-[var(--text-muted)]">Fecha propuesta de limpieza</label>
                        <div className="mt-2 grid grid-cols-[minmax(0,1fr)_7.5rem] gap-2">
                            <DatePicker id="request-planning-date" value={planningDate} min={minPlanningDate} max={maxPlanningDate} onValueChange={onPlanningDateChange} />
                            <Input aria-label="Hora propuesta de limpieza" type="time" value={planningTime} onChange={(event) => onPlanningTimeChange(event.target.value)} />
                        </div>
                        <p className="mt-2 text-sm font-medium leading-relaxed text-[var(--text-muted)]">
                            La emisora propone esta fecha. Puedes ajustarla antes de aceptar{maxPlanningDate ? ", siempre antes de la próxima entrada." : "."}
                        </p>
                    </div>
                </div>
            </section>

            <section className="border-b border-[var(--border-soft)] py-6">
                <h3 className="text-xs font-black uppercase tracking-wider text-accent">Propuesta de la empresa emisora</h3>
                <div className="mt-3 grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-[var(--border-soft)] bg-[var(--border-soft)] sm:grid-cols-4">
                    {[
                        ["Prioridad", priorityLabel],
                        ["Asignación", assigneeName],
                        ["Cantidad", `${task.quantity ?? 1} ${task.unit || "unidad"}`],
                        ["Importe", task.price !== null && task.price !== undefined ? REQUEST_CURRENCY_FORMATTER.format(task.price) : "No indicado"],
                    ].map(([label, value]) => (
                        <div key={label} className="min-w-0 bg-[var(--bg-secondary)] px-4 py-3">
                            <span className="text-xs font-semibold text-[var(--text-muted)]">{label}</span>
                            <p className="mt-1 truncate text-sm font-black text-[var(--text-main)]">{value}</p>
                        </div>
                    ))}
                </div>
            </section>

            <TaskPricingAgreementSection
                dict={dict}
                managerEditable={managerEditable}
                price={pricing.price}
                pricingLocked={false}
                pricingMode={pricing.pricingMode}
                quantity={pricing.quantity}
                snapshotSeconds={undefined}
                unit={pricing.unit}
                onPriceChange={onPriceChange}
                onPricingModeChange={onPricingModeChange}
                onQuantityChange={onQuantityChange}
                onUnitChange={onUnitChange}
            />

            {(task.checkout_reservation || task.next_reservation) && (
                <section className="border-b border-[var(--border-soft)] py-6">
                    <h3 className="text-xs font-black uppercase tracking-wider text-accent">Contexto de la reserva</h3>
                    <div className="mt-3 grid grid-cols-[1fr_auto_1fr] items-center gap-3 rounded-2xl border border-[var(--border-soft)] bg-[var(--bg-secondary)] p-4">
                        <ReservationMoment label="Salida actual" value={task.checkout_reservation?.check_out_at} fallback="Sin salida vinculada" guests={task.checkout_reservation?.guest_count} />
                        <div className="flex h-8 w-8 items-center justify-center rounded-full border border-[var(--btn-secondary-border)] bg-[var(--btn-secondary-bg)] text-accent"><ArrowRight className="h-4 w-4" /></div>
                        <ReservationMoment label="Próxima entrada" value={task.next_reservation?.check_in_at} fallback="No entra ningún huésped" guests={task.next_reservation?.guest_count} alignEnd />
                    </div>
                </section>
            )}

            {task.checkout_reservation?.notes && (
                <section className="border-b border-[var(--border-soft)] py-6">
                    <h3 className="text-xs font-black uppercase tracking-wider text-accent">Indicaciones de la empresa emisora</h3>
                    <div className="mt-3 rounded-2xl border border-orange-500/25 bg-orange-500/[0.07] p-4"><p className="text-sm font-medium leading-6 text-[var(--text-main)]">{task.checkout_reservation.notes}</p></div>
                </section>
            )}

            <section className="pt-6">
                <h3 className="text-xs font-black uppercase tracking-wider text-accent">Descripción e instrucciones</h3>
                <InstructionList description={description} emptyText="No se han añadido instrucciones para este servicio." className="mt-3" />
            </section>
        </div>
    );
}

function ReservationMoment({ label, value, fallback, guests, alignEnd = false }: {
    label: string;
    value?: string | null;
    fallback: string;
    guests?: number;
    alignEnd?: boolean;
}) {
    const alignment = alignEnd ? "text-right" : "";
    const guestAlignment = alignEnd ? "justify-end" : "";
    return (
        <div className={`min-w-0 ${alignment}`}>
            <span className="text-xs font-semibold text-[var(--text-muted)]">{label}</span>
            <p className="mt-1 text-sm font-black leading-relaxed text-[var(--text-main)]">{value ? formatDateTime(value) : fallback}</p>
            {value && typeof guests === "number" && (
                <p className={`mt-1 flex items-center gap-1.5 text-sm font-semibold text-[var(--text-muted)] ${guestAlignment}`}><Users className="h-4 w-4 text-accent" />{guests} huéspedes</p>
            )}
        </div>
    );
}
