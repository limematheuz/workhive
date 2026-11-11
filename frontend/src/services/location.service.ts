import { apiFetch, assertApiResponseOk, extractErrorMessage } from "@/lib/api"
import { LocationWorkspaceService } from "@/services/location-workspace.service"
import type {
    Location,
    LocationSpace,
    LocationSpaceTask,
    LocationZone,
    LocationDocument,
    LocationDocumentLibraryItem,
    LocationEquipment,
    LocationEquipmentLibraryItem,
    LocationEquipmentStatus,
} from "@/types/location"
import { Company } from "@/types/company"
import { User } from "@/types/user"

export type { Location, LocationSpace, LocationSpaceTask, LocationZone, LocationDocument, LocationDocumentLibraryItem, LocationEquipment, LocationEquipmentLibraryItem, LocationEquipmentStatus };

export type LocationHistoryPeriod = "day" | "week" | "month";

export interface LocationHistoryTask {
    id: number;
    title: string;
    status: string;
    completed_at: string;
    scheduled_start_at?: string | null;
}

export interface LocationHistorySession {
    id: number;
    task_item_id?: number | null;
    task_title?: string | null;
    user_id: number;
    user_name: string;
    started_at: string;
    ended_at: string;
    worked_seconds: number;
}

export interface LocationOperationalHistory {
    location_id: number;
    period: LocationHistoryPeriod;
    period_start: string;
    period_end: string;
    completed_tasks: LocationHistoryTask[];
    sessions: LocationHistorySession[];
    completed_task_count: number;
    completed_task_total: number;
    session_total: number;
    worked_seconds: number;
}

export const LocationService = {
    ...LocationWorkspaceService,

    getLocations: async (clientId?: number, readContext?: string): Promise<Location[]> => {
        const path = clientId
            ? `/api/v1/locations/?client_id=${clientId}`
            : `/api/v1/locations/`

        const response = await apiFetch(path, {
            method: "GET",
            cache: "no-store",
            headers: readContext ? { "X-Notification-Context": readContext } : undefined,
        })
        await assertApiResponseOk(response, "No se pudieron cargar las ubicaciones.")
        return await response.json()
    },

    getLocation: async (id: number, readContext?: string): Promise<Location> => {
        const response = await apiFetch(`/api/v1/locations/${id}`, {
            method: "GET",
            cache: "no-store",
            headers: readContext ? { "X-Notification-Context": readContext } : undefined,
        })
        await assertApiResponseOk(response, "Error fetching location")
        return await response.json()
    },

    createLocation: async (data: Omit<Location, "id" | "is_active">): Promise<Location> => {
        const response = await apiFetch(`/api/v1/locations/`, {
            method: "POST",
            body: JSON.stringify(data)
        })

        if (!response.ok) {
            throw new Error(await extractErrorMessage(response, "Error creating location"))
        }
        return await response.json()
    },

    updateLocation: async (id: number, data: Partial<Omit<Location, "id">>): Promise<Location> => {
        const response = await apiFetch(`/api/v1/locations/${id}`, {
            method: "PATCH",
            body: JSON.stringify(data)
        })

        if (!response.ok) {
            throw new Error(await extractErrorMessage(response, "Error updating location"))
        }
        return await response.json()
    },

    deleteLocation: async (id: number): Promise<Location> => {
        const response = await apiFetch(`/api/v1/locations/${id}`, {
            method: "DELETE"
        })

        if (!response.ok) {
            throw new Error("Error deleting location")
        }
        return await response.json()
    },

    getLocationUsers: async (locationId: number): Promise<User[]> => {
        const response = await apiFetch(`/api/v1/locations/${locationId}/users`, {
            method: "GET",
            cache: "no-store"
        })
        if (!response.ok) {
            throw new Error("Error fetching location users")
        }
        return await response.json()
    },

    getLocationServiceProviders: async (locationId: number): Promise<Company[]> => {
        const response = await apiFetch(`/api/v1/locations/${locationId}/service-providers`, {
            method: "GET",
            cache: "no-store"
        })
        if (!response.ok) {
            throw new Error("Error fetching location service providers")
        }
        return await response.json()
    },

    getZones: async (locationId: number): Promise<LocationZone[]> => {
        const response = await apiFetch(`/api/v1/locations/${locationId}/zones`, {
            method: "GET",
            cache: "no-store",
        });
        if (!response.ok) {
            throw new Error(await extractErrorMessage(response, "Error fetching location zones"));
        }
        return await response.json();
    },

    createZone: async (
        locationId: number,
        data: Pick<LocationZone, "name" | "zone_type">,
    ): Promise<LocationZone> => {
        const response = await apiFetch(`/api/v1/locations/${locationId}/zones`, {
            method: "POST",
            body: JSON.stringify(data),
        });
        if (!response.ok) {
            throw new Error(await extractErrorMessage(response, "Error creating location zone"));
        }
        return await response.json();
    },

    archiveZone: async (locationId: number, zoneId: number): Promise<void> => {
        const response = await apiFetch(`/api/v1/locations/${locationId}/zones/${zoneId}`, {
            method: "DELETE",
        });
        if (!response.ok) {
            throw new Error(await extractErrorMessage(response, "Error archiving location zone"));
        }
    },

    getOperationalHistory: async (
        locationId: number,
        period: LocationHistoryPeriod,
        anchorDate: string,
        options: { completedOffset?: number; sessionsOffset?: number; limit?: number } = {},
    ): Promise<LocationOperationalHistory> => {
        const params = new URLSearchParams({
            period,
            anchor_date: anchorDate,
            completed_offset: String(options.completedOffset ?? 0),
            sessions_offset: String(options.sessionsOffset ?? 0),
            limit: String(options.limit ?? 20),
        });
        const response = await apiFetch(
            `/api/v1/locations/${locationId}/operational-history?${params.toString()}`,
            { method: "GET", cache: "no-store" },
        );
        if (!response.ok) {
            throw new Error(await extractErrorMessage(response, "Error fetching location operational history"));
        }
        return await response.json();
    },

    deleteLocationAccess: async (locationId: number, companyId: number): Promise<void> => {
        const response = await apiFetch(`/api/v1/locations/${locationId}/company-access/${companyId}`, {
            method: "DELETE"
        })
        if (!response.ok) {
            throw new Error("Error revoking shared location access")
        }
    },
    getEquipment: async (locationId: number): Promise<LocationEquipment[]> => {
        const response = await apiFetch(`/api/v1/locations/${locationId}/equipment`, { method: "GET", cache: "no-store" });
        await assertApiResponseOk(response, "No se pudo cargar el equipo.");
        return response.json();
    },
    getEquipmentLibrary: async (): Promise<LocationEquipmentLibraryItem[]> => {
        const response = await apiFetch("/api/v1/location-equipment", { method: "GET", cache: "no-store" });
        await assertApiResponseOk(response, "No se pudo cargar el equipo.");
        return response.json();
    },
    createEquipment: async (locationId: number, data: Omit<LocationEquipment, "id" | "created_at" | "updated_at">): Promise<LocationEquipment> => {
        const response = await apiFetch(`/api/v1/locations/${locationId}/equipment`, { method: "POST", body: JSON.stringify(data) });
        await assertApiResponseOk(response, "No se pudo añadir el equipo.");
        return response.json();
    },
    updateEquipment: async (locationId: number, equipmentId: number, data: Partial<Omit<LocationEquipment, "id" | "created_at" | "updated_at">>): Promise<LocationEquipment> => {
        const response = await apiFetch(`/api/v1/locations/${locationId}/equipment/${equipmentId}`, { method: "PATCH", body: JSON.stringify(data) });
        await assertApiResponseOk(response, "No se pudo actualizar el equipo.");
        return response.json();
    },
    archiveEquipment: async (locationId: number, equipmentId: number): Promise<void> => {
        const response = await apiFetch(`/api/v1/locations/${locationId}/equipment/${equipmentId}`, { method: "DELETE" });
        await assertApiResponseOk(response, "No se pudo archivar el equipo.");
    },
}
