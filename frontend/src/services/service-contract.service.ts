import { apiFetch, assertApiResponseOk } from "@/lib/api"
import type {
    ServiceContract,
    ServiceContractTermsUpdate,
} from "@/types/service-contract"
import type { Location, LocationSpace } from "@/types/location"

export const ServiceContractService = {
    getContracts: async (filters: {
        status?: string
        skip?: number
        limit?: number
    } = {}): Promise<ServiceContract[]> => {
        const params = new URLSearchParams()
        if (filters.status) params.set("contract_status", filters.status)
        if (filters.skip) params.set("skip", String(filters.skip))
        if (filters.limit) params.set("limit", String(filters.limit))
        const response = await apiFetch(`/api/v1/service-contracts/?${params.toString()}`, {
            method: "GET",
            cache: "no-store",
        })
        await assertApiResponseOk(response, "No se pudieron cargar los contratos")
        return await response.json()
    },

    getContract: async (id: number): Promise<ServiceContract> => {
        const response = await apiFetch(`/api/v1/service-contracts/${id}`, {
            method: "GET",
            cache: "no-store",
        })
        await assertApiResponseOk(response, "No se pudo cargar el contrato")
        return await response.json()
    },

    getLocationCandidates: async (id: number): Promise<Location[]> => {
        const response = await apiFetch(`/api/v1/service-contracts/${id}/location-candidates`, {
            method: "GET",
            cache: "no-store",
        })
        await assertApiResponseOk(response, "No se pudieron cargar las ubicaciones del cliente")
        return await response.json()
    },

    updateTerms: async (
        id: number,
        payload: ServiceContractTermsUpdate,
    ): Promise<ServiceContract> => {
        const response = await apiFetch(`/api/v1/service-contracts/${id}`, {
            method: "PATCH",
            body: JSON.stringify(payload),
        })
        await assertApiResponseOk(response, "No se pudieron guardar las condiciones")
        return await response.json()
    },

    addLocations: async (id: number, locationIds: number[]): Promise<ServiceContract> => {
        const response = await apiFetch(`/api/v1/service-contracts/${id}/locations`, {
            method: "POST",
            body: JSON.stringify({ location_ids: locationIds }),
        })
        await assertApiResponseOk(response, "No se pudieron añadir las ubicaciones")
        return await response.json()
    },

    removeLocation: async (id: number, locationId: number): Promise<ServiceContract> => {
        const response = await apiFetch(`/api/v1/service-contracts/${id}/locations/${locationId}`, {
            method: "DELETE",
        })
        await assertApiResponseOk(response, "No se pudo retirar la ubicación")
        return await response.json()
    },

    getLocationZoneCandidates: async (id: number, locationId: number): Promise<LocationSpace[]> => {
        const response = await apiFetch(`/api/v1/service-contracts/${id}/locations/${locationId}/zone-candidates`, {
            method: "GET",
            cache: "no-store",
        })
        await assertApiResponseOk(response, "No se pudieron cargar los espacios de la ubicación")
        return await response.json()
    },

    updateLocationZones: async (
        id: number,
        locationId: number,
        zoneIds: number[],
    ): Promise<ServiceContract> => {
        const response = await apiFetch(`/api/v1/service-contracts/${id}/locations/${locationId}/zones`, {
            method: "PUT",
            body: JSON.stringify({ zone_ids: zoneIds }),
        })
        await assertApiResponseOk(response, "No se pudo actualizar la cobertura por zonas")
        return await response.json()
    },

    activate: async (id: number): Promise<ServiceContract> => {
        const response = await apiFetch(`/api/v1/service-contracts/${id}/activate`, {
            method: "POST",
        })
        await assertApiResponseOk(response, "No se pudo activar el contrato")
        return await response.json()
    },
}
