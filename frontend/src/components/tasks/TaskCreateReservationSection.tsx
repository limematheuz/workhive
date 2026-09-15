"use client";

import { Loader2 } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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

const NO_RESERVATION_ID = "__workhive_no_reservation__";

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
                        <Select
                            value={newCheckoutReservationId || NO_RESERVATION_ID}
                            onValueChange={(value) => setNewCheckoutReservationId(value === NO_RESERVATION_ID ? "" : value)}
                        >
                            <SelectTrigger
                                id="task-create-checkout-reservation"
                                aria-label={dict.tasks?.create_dialog?.checkout_reservation || "Checkout reservation"}
                                className={taskFormControlClass}
                            >
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value={NO_RESERVATION_ID}>
                                    {dict.tasks?.create_dialog?.no_checkout_reservation || "No checkout linked"}
                                </SelectItem>
                                {availableReservations.map(reservation => (
                                    <SelectItem key={reservation.id} value={String(reservation.id)}>
                                        Sale {new Date(reservation.check_out_at).toLocaleString("es-ES", { dateStyle: "short", timeStyle: "short", timeZone: "UTC" })} · {reservation.guest_count} huéspedes
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-1.5">
                        <label htmlFor="task-create-next-reservation" className={taskFormLabelClass}>
                            {dict.tasks?.create_dialog?.next_reservation || "Next check-in"}
                        </label>
                        <Select
                            value={newNextReservationId || NO_RESERVATION_ID}
                            onValueChange={(value) => setNewNextReservationId(value === NO_RESERVATION_ID ? "" : value)}
                        >
                            <SelectTrigger
                                id="task-create-next-reservation"
                                aria-label={dict.tasks?.create_dialog?.next_reservation || "Next check-in"}
                                className={taskFormControlClass}
                            >
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value={NO_RESERVATION_ID}>
                                    {dict.tasks?.create_dialog?.no_next_reservation || "No next check-in"}
                                </SelectItem>
                                {availableReservations.map(reservation => (
                                    <SelectItem key={reservation.id} value={String(reservation.id)}>
                                        Entra {new Date(reservation.check_in_at).toLocaleString("es-ES", { dateStyle: "short", timeStyle: "short", timeZone: "UTC" })} · {reservation.guest_count} huéspedes
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </div>
            )}
        </section>
    );
}
