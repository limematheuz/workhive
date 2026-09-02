import { apiFetch, assertApiResponseOk, extractErrorMessage } from "@/lib/api"
import {
    Client,
    ClientContact,
    ClientContactPayload,
    ClientContactRole,
} from "@/types/client"

export type { Client, ClientContact, ClientContactPayload, ClientContactRole };

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
}
