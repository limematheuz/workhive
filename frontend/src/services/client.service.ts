import { apiFetch } from "@/lib/api"
import { Client } from "@/types/client"

export type { Client };

export const ClientService = {
    getClients: async (isActive: boolean | null = true): Promise<Client[]> => {
        const query = isActive === null
            ? "include_inactive=true"
            : `is_active=${isActive}`
        const response = await apiFetch(`/api/v1/clients/?${query}`, {
            method: "GET",
            cache: "no-store"
        })
        if (!response.ok) {
            throw new Error("Error fetching clients")
        }
        return await response.json()
    },

    getClient: async (id: number): Promise<Client> => {
        const response = await apiFetch(`/api/v1/clients/${id}`, {
            method: "GET",
            cache: "no-store"
        })
        if (!response.ok) {
            throw new Error("Error fetching client")
        }
        return await response.json()
    },

    createClient: async (data: Omit<Client, "id" | "is_active" | "company_id">): Promise<Client> => {
        const response = await apiFetch(`/api/v1/clients/`, {
            method: "POST",
            body: JSON.stringify(data)
        })
        if (!response.ok) {
            const errData = await response.json().catch(() => ({}))
            throw new Error(errData.detail || "Error creating client")
        }
        return await response.json()
    },

    updateClient: async (id: number, data: Partial<Omit<Client, "id" | "company_id">>): Promise<Client> => {
        const response = await apiFetch(`/api/v1/clients/${id}`, {
            method: "PATCH",
            body: JSON.stringify(data)
        })
        if (!response.ok) {
            const errData = await response.json().catch(() => ({}))
            throw new Error(errData.detail || "Error updating client")
        }
        return await response.json()
    },

    deleteClient: async (id: number): Promise<Client> => {
        const response = await apiFetch(`/api/v1/clients/${id}`, {
            method: "DELETE"
        })
        if (!response.ok) {
            throw new Error("Error deleting client")
        }
        return await response.json()
    }
}
