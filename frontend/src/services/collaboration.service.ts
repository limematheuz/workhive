import { apiFetch } from "@/lib/api";
import { CompanyCollaboration } from "@/types/collaboration";
import { Company } from "@/types/company";

export const CollaborationService = {
    getPartnerCode: async (): Promise<string> => {
        const response = await apiFetch("/api/v1/collaborations/code", {
            method: "GET",
            cache: "no-store",
        });
        if (!response.ok) {
            throw new Error("No se pudo obtener el código de partner");
        }
        const data = await response.json();
        return data.partner_code;
    },

    getCollaborations: async (): Promise<CompanyCollaboration[]> => {
        const response = await apiFetch("/api/v1/collaborations/", {
            method: "GET",
            cache: "no-store",
        });
        if (!response.ok) {
            throw new Error("No se pudieron cargar las colaboraciones");
        }
        return await response.json();
    },

    getServiceProviders: async (): Promise<Company[]> => {
        const response = await apiFetch("/api/v1/collaborations/service-providers", {
            method: "GET",
            cache: "no-store",
        });
        if (!response.ok) {
            throw new Error("No se pudieron cargar las empresas colaboradoras");
        }
        return await response.json();
    },

    getPendingRequests: async (): Promise<CompanyCollaboration[]> => {
        const response = await apiFetch("/api/v1/collaborations/requests/pending", {
            method: "GET",
            cache: "no-store",
        });
        if (!response.ok) {
            throw new Error("No se pudieron cargar las solicitudes pendientes");
        }
        return await response.json();
    },

    getSentRequests: async (): Promise<CompanyCollaboration[]> => {
        const response = await apiFetch("/api/v1/collaborations/requests/sent", {
            method: "GET",
            cache: "no-store",
        });
        if (!response.ok) {
            throw new Error("No se pudieron cargar las solicitudes enviadas");
        }
        return await response.json();
    },

    sendCollaborationRequest: async (
        partnerCode: string,
        roleType: string = "service_provider"
    ): Promise<CompanyCollaboration> => {
        const response = await apiFetch("/api/v1/collaborations/requests", {
            method: "POST",
            body: JSON.stringify({
                partner_code: partnerCode.trim().toUpperCase(),
                role_type: roleType,
            }),
        });
        if (!response.ok) {
            const errData = await response.json().catch(() => ({}));
            throw new Error(errData.detail || "No se pudo enviar la solicitud de vinculación");
        }
        return await response.json();
    },

    acceptRequest: async (id: number): Promise<CompanyCollaboration> => {
        const response = await apiFetch(`/api/v1/collaborations/requests/${id}/accept`, {
            method: "POST",
        });
        if (!response.ok) {
            const errData = await response.json().catch(() => ({}));
            throw new Error(errData.detail || "No se pudo aceptar la solicitud");
        }
        return await response.json();
    },

    rejectRequest: async (id: number): Promise<CompanyCollaboration> => {
        const response = await apiFetch(`/api/v1/collaborations/requests/${id}/reject`, {
            method: "POST",
        });
        if (!response.ok) {
            const errData = await response.json().catch(() => ({}));
            throw new Error(errData.detail || "No se pudo rechazar la solicitud");
        }
        return await response.json();
    },

    deleteCollaboration: async (id: number): Promise<void> => {
        const response = await apiFetch(`/api/v1/collaborations/${id}`, {
            method: "DELETE",
        });
        if (!response.ok) {
            const errData = await response.json().catch(() => ({}));
            throw new Error(errData.detail || "No se pudo eliminar la colaboración");
        }
    },
};
