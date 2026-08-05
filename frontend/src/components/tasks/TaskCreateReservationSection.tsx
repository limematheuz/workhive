"use client";

import { Loader2 } from "lucide-react";
import type { Dictionary } from "@/lib/dictionary-context";
import type { Reservation } from "@/types/reservation";
import {
    taskFormControlClass,
    taskFormLabelClass,
    taskFormSectionClass,
    taskFormSectionHeaderClass,
    taskFormSectionHintClass,
    taskFormSectionTitleClass,
} from "./taskFormLayout";

type TaskCreateReservationSectionProps = {
    dict: Dictionary;
    loadingReservations: boolean;
    availableReservations: Reservation[];
    newCheckoutReservationId: string;
    setNewCheckoutReservationId: (val: string) => void;
    newNextReservationId: string;
    setNewNextReservationId: (val: string) => void;
};

export function TaskCreateReservationSection({
    dict,
    loadingReservations,
    availableReservations,
    newCheckoutReservationId,
    setNewCheckoutReservationId,
    newNextReservationId,
    setNewNextReservationId,
}: TaskCreateReservationSectionProps) {
    return (
        <section className={taskFormSectionClass}>
            <div className={taskFormSectionHeaderClass}>
                <h3 className={taskFormSectionTitleClass}>
                    {dict.tasks?.create_dialog?.reservation_section || "Reservation context"}
                </h3>
                <p className={taskFormSectionHintClass}>
                    {dict.tasks?.create_dialog?.reservation_section_hint
                        || "Optional. Use it only when this company manages this location’s reservations."}
                </p>
            </div>
            {loadingReservations ? (
                <div className="flex items-center gap-2 text-2xs text-[var(--text-muted)]">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    {dict.tasks?.create_dialog?.loading_reservations || "Loading reservations..."}
                </div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                        <label htmlFor="task-create-checkout-reservation" className={taskFormLabelClass}>
                            {dict.tasks?.create_dialog?.checkout_reservation || "Checkout reservation"}
                        </label>
                        <select
                            id="task-create-checkout-reservation"
                            value={newCheckoutReservationId}
                            onChange={(event) => setNewCheckoutReservationId(event.target.value)}
                            aria-label={dict.tasks?.create_dialog?.checkout_reservation || "Checkout reservation"}
                            className={taskFormControlClass}
                        >
                            <option value="">
                                {dict.tasks?.create_dialog?.no_checkout_reservation || "No checkout linked"}
                            </option>
                            {availableReservations.map(reservation => (
                                <option key={reservation.id} value={reservation.id}>
                                    Sale {new Date(reservation.check_out_at).toLocaleString("es-ES", { dateStyle: "short", timeStyle: "short", timeZone: "UTC" })} · {reservation.guest_count} huéspedes
                                </option>
                            ))}
                        </select>
                    </div>
                    <div className="space-y-1.5">
                        <label htmlFor="task-create-next-reservation" className={taskFormLabelClass}>
                            {dict.tasks?.create_dialog?.next_reservation || "Next check-in"}
                        </label>
                        <select
                            id="task-create-next-reservation"
                            value={newNextReservationId}
                            onChange={(event) => setNewNextReservationId(event.target.value)}
                            aria-label={dict.tasks?.create_dialog?.next_reservation || "Next check-in"}
                            className={taskFormControlClass}
                        >
                            <option value="">
                                {dict.tasks?.create_dialog?.no_next_reservation || "No next check-in"}
                            </option>
                            {availableReservations.map(reservation => (
                                <option key={reservation.id} value={reservation.id}>
                                    Entra {new Date(reservation.check_in_at).toLocaleString("es-ES", { dateStyle: "short", timeStyle: "short", timeZone: "UTC" })} · {reservation.guest_count} huéspedes
                                </option>
                            ))}
                        </select>
                    </div>
                </div>
            )}
        </section>
    );
}
