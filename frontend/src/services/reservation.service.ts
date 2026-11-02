import { apiFetch, extractErrorMessage } from "@/lib/api";
import { Reservation, ReservationInput } from "@/types/reservation";

export const ReservationService = {
    getUpcomingArrivals: async (days: number = 3, readContext?: string): Promise<Reservation[]> => {
        const response = await apiFetch(`/api/v1/reservations/upcoming/arrivals?days=${days}`, {
            method: "GET",
            cache: "no-store",
            headers: readContext ? { "X-Notification-Context": readContext } : undefined,
        });
        if (!response.ok) throw new Error("No se pudieron cargar las próximas entradas");
        return response.json();
    },

    getReservations: async (filters: {
        locationId?: number;
        dateFrom?: string;
        dateTo?: string;
    } = {}, readContext?: string): Promise<Reservation[]> => {
        const params = new URLSearchParams();
        if (filters.locationId) params.set("location_id", filters.locationId.toString());
        if (filters.dateFrom) params.set("date_from", filters.dateFrom);
        if (filters.dateTo) params.set("date_to", filters.dateTo);
        const response = await apiFetch(`/api/v1/reservations/?${params.toString()}`, {
            method: "GET",
            cache: "no-store",
            headers: readContext ? { "X-Notification-Context": readContext } : undefined,
        });
        if (!response.ok) throw new Error("No se pudieron cargar las reservas");
        return response.json();
    },

    getReservation: async (id: number): Promise<Reservation> => {
        const response = await apiFetch(`/api/v1/reservations/${id}`, {
            method: "GET",
            cache: "no-store",
        });
        if (!response.ok) throw new Error("No se pudo cargar la reserva");
        return response.json();
    },

    createReservation: async (data: ReservationInput): Promise<Reservation> => {
        const response = await apiFetch("/api/v1/reservations/", {
            method: "POST",
            body: JSON.stringify(data),
        });
        if (!response.ok) {
            const errMsg = await extractErrorMessage(response, "No se pudo crear la reserva");
            throw new Error(errMsg);
        }
        return response.json();
    },

    updateReservation: async (
        id: number,
        data: Partial<ReservationInput>
    ): Promise<Reservation> => {
        const response = await apiFetch(`/api/v1/reservations/${id}`, {
            method: "PATCH",
            body: JSON.stringify(data),
        });
        if (!response.ok) {
            const errMsg = await extractErrorMessage(response, "No se pudo actualizar la reserva");
            throw new Error(errMsg);
        }
        return response.json();
    },
};
