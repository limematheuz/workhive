import type { Location } from "@/types/location";
import type { Reservation, ReservationInput } from "@/types/reservation";

import type {
    ReservationFiltersState,
    ReservationFormState,
    ReservationProviderOption,
    ReservationViewMode,
} from "./types";

export function toLocalInput(date: Date | string): string {
    const value = typeof date === "string" ? new Date(date) : date;
    const offset = value.getTimezoneOffset() * 60_000;
    return new Date(value.getTime() - offset).toISOString().slice(0, 16);
}

function defaultDates(): { checkIn: string; checkOut: string } {
    const checkIn = new Date();
    checkIn.setDate(checkIn.getDate() + 1);
    checkIn.setHours(16, 0, 0, 0);
    const checkOut = new Date(checkIn);
    checkOut.setDate(checkOut.getDate() + 2);
    checkOut.setHours(11, 0, 0, 0);
    return { checkIn: toLocalInput(checkIn), checkOut: toLocalInput(checkOut) };
}

export function createEmptyReservationForm(
    locationId = "",
    defaultProviderId?: number | null
): ReservationFormState {
    const dates = defaultDates();
    return {
        locationId,
        checkIn: dates.checkIn,
        checkOut: dates.checkOut,
        guestCount: "1",
        stayType: "guest",
        status: "confirmed",
        cleaningRequired: true,
        cleaningScheduledAt: dates.checkOut,
        notes: "",
        assignedUserId: defaultProviderId?.toString() || "",
    };
}

export function createReservationForm(reservation: Reservation): ReservationFormState {
    return {
        locationId: reservation.location_id.toString(),
        checkIn: toLocalInput(reservation.check_in_at),
        checkOut: toLocalInput(reservation.check_out_at),
        guestCount: reservation.guest_count.toString(),
        stayType: reservation.stay_type,
        status: reservation.status,
        cleaningRequired: reservation.cleaning_required,
        cleaningScheduledAt: reservation.cleaning_scheduled_at
            ? toLocalInput(reservation.cleaning_scheduled_at)
            : toLocalInput(reservation.check_out_at),
        notes: reservation.notes || "",
        assignedUserId: reservation.assigned_company_id
            ? reservation.assigned_company_id.toString()
            : "",
    };
}

export function createReservationPayload(
    form: ReservationFormState,
    editing: Reservation | null
): ReservationInput {
    return {
        location_id: Number(form.locationId),
        check_in_at: new Date(form.checkIn).toISOString(),
        check_out_at: new Date(form.checkOut).toISOString(),
        guest_count: Number(form.guestCount),
        stay_type: form.stayType as ReservationInput["stay_type"],
        status: form.status as ReservationInput["status"],
        source: editing?.source || "manual",
        external_reference: editing?.external_reference || null,
        notes: form.notes || null,
        cleaning_required: form.cleaningRequired,
        assigned_company_id: form.assignedUserId ? Number(form.assignedUserId) : null,
        cleaning_scheduled_at:
            form.cleaningRequired && form.cleaningScheduledAt
                ? new Date(form.cleaningScheduledAt).toISOString()
                : null,
    };
}

export function canManageLocationReservations(
    location: Location,
    companyId?: number | null
): boolean {
    if (typeof location.can_manage_reservations === "boolean") {
        return location.can_manage_reservations;
    }
    const ownerCompanyId = location.owner_company_id ?? location.managing_company_id;
    return Boolean(companyId && ownerCompanyId === companyId);
}

/**
 * Linking a manual task to guest reservations is reserved for the emitting
 * company (or a property manager). The API returns this explicit capability;
 * fail closed while locations are still loading or when the response is old.
 */
export function canLinkTaskReservations(location: Location): boolean {
    return location.can_manage_reservations === true;
}

export function getReservableLocations(
    locations: Location[],
    companyId?: number | null
): Location[] {
    return locations.filter((location) =>
        canManageLocationReservations(location, companyId)
    );
}

export function getReservationProviderOptions(
    reservations: Reservation[]
): ReservationProviderOption[] {
    const providers = new Map<number, string>();
    reservations.forEach((reservation) => {
        if (reservation.assigned_company_id) {
            providers.set(
                reservation.assigned_company_id,
                reservation.assigned_company_name ||
                    `Empresa #${reservation.assigned_company_id}`
            );
        }
    });
    return Array.from(providers.entries())
        .map(([id, name]) => ({ id, name }))
        .sort((a, b) => a.name.localeCompare(b.name, "es"));
}

interface FilterReservationsParams {
    reservations: Reservation[];
    locationMap: Map<number, Location>;
    companyId?: number | null;
    filters: ReservationFiltersState;
    viewMode: ReservationViewMode;
}

export function filterReservations({
    reservations,
    locationMap,
    companyId,
    filters,
    viewMode,
}: FilterReservationsParams): Reservation[] {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const nextWeek = new Date(today);
    nextWeek.setDate(nextWeek.getDate() + 7);
    const query = filters.search.trim().toLocaleLowerCase("es");

    const matchesManageable = (reservation: Reservation) => {
        const location = locationMap.get(reservation.location_id);
        return Boolean(
            location
            && (
                canManageLocationReservations(location, companyId)
                || reservation.assigned_company_id === companyId
            )
        );
    };

    const matchesLocation = (reservation: Reservation) =>
        filters.location === "ALL" ||
        reservation.location_id === Number(filters.location);

    const matchesProvider = (reservation: Reservation) => {
        if (filters.provider === "ALL") return true;
        if (filters.provider === "INTERNAL") {
            return !reservation.assigned_company_id;
        }
        return reservation.assigned_company_id === Number(filters.provider);
    };

    const matchesCleaning = (reservation: Reservation) => {
        if (filters.cleaning === "ALL") return true;
        if (filters.cleaning === "NO_CLEANING") {
            return !reservation.cleaning_required;
        }
        if (filters.cleaning === "UNASSIGNED") {
            return (
                reservation.cleaning_required &&
                !reservation.assigned_company_id
            );
        }
        return reservation.cleaning_status === filters.cleaning;
    };

    const matchesPeriod = (reservation: Reservation) => {
        const checkIn = new Date(reservation.check_in_at);
        if (filters.year !== "ALL" && checkIn.getFullYear() !== Number(filters.year)) {
            return false;
        }
        if (filters.month !== "ALL" && checkIn.getMonth() + 1 !== Number(filters.month)) {
            return false;
        }
        return true;
    };

    const matchesViewAndDate = (reservation: Reservation) => {
        const checkOut = new Date(reservation.check_out_at);
        const isPast = checkOut < new Date();
        const isWorkDone = reservation.cleaning_status === "completed";
        const isCancelled = reservation.status === "cancelled";
        const isHistorical = isPast || isWorkDone || isCancelled;

        if (viewMode === "history") return isHistorical;
        if (isHistorical) return false;

        if (filters.date === "ALL") return true;
        const checkIn = new Date(reservation.check_in_at);
        if (filters.date === "TODAY") {
            return checkIn < tomorrow && checkOut >= today;
        }
        if (filters.date === "NEXT_7") {
            return checkIn >= today && checkIn < nextWeek;
        }
        if (filters.date === "PAST") return checkOut < today;
        return checkOut >= today;
    };

    const matchesSearch = (reservation: Reservation) => {
        if (!query) return true;
        const location = locationMap.get(reservation.location_id);
        return [
            location?.name,
            location?.address,
            reservation.assigned_company_name,
            reservation.notes,
        ]
            .filter(Boolean)
            .some((value) =>
                value!.toLocaleLowerCase("es").includes(query)
            );
    };

    const matchesCancelled = (reservation: Reservation) =>
        filters.showCancelled || reservation.status !== "cancelled";

    return reservations
        .filter((reservation) =>
            matchesManageable(reservation)
            && matchesLocation(reservation)
            && matchesProvider(reservation)
            && matchesCleaning(reservation)
            && matchesPeriod(reservation)
            && matchesViewAndDate(reservation)
            && matchesSearch(reservation)
            && matchesCancelled(reservation)
        )
        .sort((a, b) => {
            if (viewMode === "history") {
                return (
                    new Date(b.check_out_at).getTime() -
                    new Date(a.check_out_at).getTime()
                );
            }
            return (
                new Date(a.check_in_at).getTime() -
                new Date(b.check_in_at).getTime()
            );
        });
}
