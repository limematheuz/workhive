import { apiFetch, assertApiResponseOk, extractErrorMessage } from "@/lib/api"
import {
    Client,
    ClientContact,
    ClientContactPayload,
    ClientContactRole,
    ClientOpportunity,
    ClientOpportunityActivity,
    ClientOpportunityActivityType,
    ClientOpportunityOwner,
    ClientOpportunityPayload,
    ClientOpportunityStage,
} from "@/types/client"

export type {
    Client,
    ClientContact,
    ClientContactPayload,
    ClientContactRole,
    ClientOpportunity,
    ClientOpportunityActivity,
    ClientOpportunityActivityType,
    ClientOpportunityOwner,
    ClientOpportunityPayload,
    ClientOpportunityStage,
};

export type ClientEmailPayload = {
    recipient_emails: string[];
    copy_emails: string[];
    subject?: string;
    message?: string;
    send_copy: boolean;
    save_recipients: boolean;
    save_recipient_to_client_id?: number;
    locale: "es" | "en";
};

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
    },

    sendClientEmail: async (id: number, data: ClientEmailPayload): Promise<{ status: string; recipient_email: string }> => {
        const response = await apiFetch(`/api/v1/clients/${id}/send-email`, {
            method: "POST",
            body: JSON.stringify(data),
        })
        if (!response.ok) {
            throw new Error(await extractErrorMessage(response, "Error sending client email"))
        }
        return await response.json()
    },

    getClientContacts: async (clientId: number): Promise<ClientContact[]> => {
        const response = await apiFetch(`/api/v1/clients/${clientId}/contacts`, {
            method: "GET",
            cache: "no-store",
        });
        await assertApiResponseOk(response, "No se pudieron cargar los contactos");
        return await response.json();
    },

    createClientContact: async (clientId: number, data: ClientContactPayload): Promise<ClientContact> => {
        const response = await apiFetch(`/api/v1/clients/${clientId}/contacts`, {
            method: "POST",
            body: JSON.stringify(data),
        });
        await assertApiResponseOk(response, "No se pudo crear el contacto");
        return await response.json();
    },

    updateClientContact: async (clientId: number, contactId: number, data: Partial<ClientContactPayload>): Promise<ClientContact> => {
        const response = await apiFetch(`/api/v1/clients/${clientId}/contacts/${contactId}`, {
            method: "PATCH",
            body: JSON.stringify(data),
        });
        await assertApiResponseOk(response, "No se pudo actualizar el contacto");
        return await response.json();
    },

    deactivateClientContact: async (clientId: number, contactId: number): Promise<ClientContact> => {
        const response = await apiFetch(`/api/v1/clients/${clientId}/contacts/${contactId}`, {
            method: "DELETE",
        });
        await assertApiResponseOk(response, "No se pudo desactivar el contacto");
        return await response.json();
    },

    getClientOpportunities: async (clientId: number): Promise<ClientOpportunity[]> => {
        const response = await apiFetch(`/api/v1/clients/${clientId}/opportunities`, {
            method: "GET",
            cache: "no-store",
        });
        await assertApiResponseOk(response, "No se pudieron cargar los seguimientos");
        return await response.json();
    },

    getClientOpportunityOwners: async (clientId: number): Promise<ClientOpportunityOwner[]> => {
        const response = await apiFetch(`/api/v1/clients/${clientId}/opportunity-owners`, {
            method: "GET",
            cache: "no-store",
        });
        await assertApiResponseOk(response, "No se pudieron cargar las personas responsables");
        return await response.json();
    },

    createClientOpportunity: async (clientId: number, data: ClientOpportunityPayload): Promise<ClientOpportunity> => {
        const response = await apiFetch(`/api/v1/clients/${clientId}/opportunities`, {
            method: "POST",
            body: JSON.stringify(data),
        });
        await assertApiResponseOk(response, "No se pudo crear el seguimiento");
        return await response.json();
    },

    updateClientOpportunity: async (
        clientId: number,
        opportunityId: number,
        data: Partial<ClientOpportunityPayload>,
    ): Promise<ClientOpportunity> => {
        const response = await apiFetch(`/api/v1/clients/${clientId}/opportunities/${opportunityId}`, {
            method: "PATCH",
            body: JSON.stringify(data),
        });
        await assertApiResponseOk(response, "No se pudo actualizar el seguimiento");
        return await response.json();
    },

    getClientOpportunityActivities: async (
        clientId: number,
        opportunityId: number,
    ): Promise<ClientOpportunityActivity[]> => {
        const response = await apiFetch(`/api/v1/clients/${clientId}/opportunities/${opportunityId}/activities`, {
            method: "GET",
            cache: "no-store",
        });
        await assertApiResponseOk(response, "No se pudo cargar el historial comercial");
        return await response.json();
    },

    createClientOpportunityActivity: async (
        clientId: number,
        opportunityId: number,
        data: { activity_type: ClientOpportunityActivityType; body: string; happened_at?: string | null },
    ): Promise<ClientOpportunityActivity> => {
        const response = await apiFetch(`/api/v1/clients/${clientId}/opportunities/${opportunityId}/activities`, {
            method: "POST",
            body: JSON.stringify(data),
        });
        await assertApiResponseOk(response, "No se pudo guardar la actividad comercial");
        return await response.json();
    },
}
