import { apiFetch, extractErrorMessage } from "@/lib/api"
import { Location } from "@/types/location"
import { Company } from "@/types/company"
import { User } from "@/types/user"

export type { Location };

export const LocationService = {
    getLocations: async (clientId?: number): Promise<Location[]> => {
        const path = clientId
            ? `/api/v1/locations/?client_id=${clientId}`
            : `/api/v1/locations/`

        const response = await apiFetch(path, {
            method: "GET",
            cache: "no-store"
        })
        if (!response.ok) {
            throw new Error("Error fetching locations")
        }
        return await response.json()
    },

    getLocation: async (id: number): Promise<Location> => {
        const response = await apiFetch(`/api/v1/locations/${id}`, {
            method: "GET",
            cache: "no-store"
        })
        if (!response.ok) {
            throw new Error("Error fetching location")
        }
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

    deleteLocationAccess: async (locationId: number, companyId: number): Promise<void> => {
        const response = await apiFetch(`/api/v1/locations/${locationId}/company-access/${companyId}`, {
            method: "DELETE"
        })
        if (!response.ok) {
            throw new Error("Error revoking shared location access")
        }
    }
}
