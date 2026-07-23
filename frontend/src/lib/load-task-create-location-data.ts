import type { Reservation } from "../types/reservation.ts";
import type { LocationTemplate } from "../types/template.ts";

export type TaskCreateLocationDataLoaders = {
    getLocationTemplates: (locationId: number) => Promise<LocationTemplate[]>;
    getReservations: (locationId: number) => Promise<Reservation[]>;
};

export type TaskCreateLocationData = {
    locationTemplates: LocationTemplate[];
    reservations: Reservation[];
    locationTemplatesError: unknown | null;
    reservationsError: unknown | null;
};

export async function loadTaskCreateLocationData(
    locationId: number,
    loaders: TaskCreateLocationDataLoaders,
): Promise<TaskCreateLocationData> {
    const [templatesResult, reservationsResult] = await Promise.allSettled([
        loaders.getLocationTemplates(locationId),
        loaders.getReservations(locationId),
    ]);

    return {
        locationTemplates:
            templatesResult.status === "fulfilled" ? templatesResult.value : [],
        reservations:
            reservationsResult.status === "fulfilled"
                ? reservationsResult.value
                : [],
        locationTemplatesError:
            templatesResult.status === "rejected" ? templatesResult.reason : null,
        reservationsError:
            reservationsResult.status === "rejected"
                ? reservationsResult.reason
                : null,
    };
}
