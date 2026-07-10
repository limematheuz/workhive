"use client";

import { Loader2 } from "lucide-react";
import type { Reservation } from "@/types/reservation";

type TaskCreateReservationSectionProps = {
    loadingReservations: boolean;
    availableReservations: Reservation[];
    newCheckoutReservationId: string;
    setNewCheckoutReservationId: (val: string) => void;
    newNextReservationId: string;
    setNewNextReservationId: (val: string) => void;
};

export function TaskCreateReservationSection({
    loadingReservations,
    availableReservations,
    newCheckoutReservationId,
    setNewCheckoutReservationId,
    newNextReservationId,
    setNewNextReservationId,
}: TaskCreateReservationSectionProps) {
    return (
        <div className="border-y border-[var(--border-soft)] py-4 space-y-3">
            <div>
                <h3 className="text-xs font-black text-[var(--text-main)]">Contexto de reservas</h3>
                <p className="text-2xs text-[var(--text-muted)] mt-1">
                    Opcional. Déjalo vacío para registrar una limpieza sin huéspedes.
                </p>
            </div>
            {loadingReservations ? (
                <div className="flex items-center gap-2 text-2xs text-[var(--text-muted)]">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Cargando reservas...
                </div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                        <label htmlFor="task-create-checkout-reservation" className="text-2xs uppercase font-bold text-[var(--text-muted)]">
                            Reserva que sale
                        </label>
                        <select
                            id="task-create-checkout-reservation"
                            value={newCheckoutReservationId}
                            onChange={(event) => setNewCheckoutReservationId(event.target.value)}
                            aria-label="Reserva que sale"
                            className="w-full bg-[var(--bg-card)] border border-[var(--border-color)] text-[var(--text-main)] rounded-xl px-3 py-2.5 text-xs outline-none focus:border-accent"
                        >
                            <option value="">Sin salida vinculada</option>
                            {availableReservations.map(reservation => (
                                <option key={reservation.id} value={reservation.id}>
                                    Sale {new Date(reservation.check_out_at).toLocaleString("es-ES", { dateStyle: "short", timeStyle: "short", timeZone: "UTC" })} · {reservation.guest_count} huéspedes
                                </option>
                            ))}
                        </select>
                    </div>
                    <div className="space-y-1.5">
                        <label htmlFor="task-create-next-reservation" className="text-2xs uppercase font-bold text-[var(--text-muted)]">
                            Próxima entrada
                        </label>
                        <select
                            id="task-create-next-reservation"
                            value={newNextReservationId}
                            onChange={(event) => setNewNextReservationId(event.target.value)}
                            aria-label="Próxima entrada"
                            className="w-full bg-[var(--bg-card)] border border-[var(--border-color)] text-[var(--text-main)] rounded-xl px-3 py-2.5 text-xs outline-none focus:border-accent"
                        >
                            <option value="">Sin próxima entrada</option>
                            {availableReservations.map(reservation => (
                                <option key={reservation.id} value={reservation.id}>
                                    Entra {new Date(reservation.check_in_at).toLocaleString("es-ES", { dateStyle: "short", timeStyle: "short", timeZone: "UTC" })} · {reservation.guest_count} huéspedes
                                </option>
                            ))}
                        </select>
                    </div>
                </div>
            )}
        </div>
    );
}
