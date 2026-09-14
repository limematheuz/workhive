import { apiFetch, assertApiResponseOk } from "@/lib/api";
import type {
    ClientPortalGrant,
    ClientPortalInspection,
    ClientPortalInspectionAcceptancePayload,
    ClientPortalInvitation,
    ClientPortalInvitationAcceptPayload,
    ClientPortalOverview,
    ClientPortalWorkspace,
} from "@/types/client-portal";

export const ClientPortalService = {
    getWorkspaces: async (): Promise<ClientPortalWorkspace[]> => {
        const response = await apiFetch("/api/v1/client-portal/workspaces", { method: "GET", cache: "no-store" });
        await assertApiResponseOk(response, "No se pudieron cargar tus empresas");
        return response.json();
    },

    getOverview: async (workspaceId: number): Promise<ClientPortalOverview> => {
        const response = await apiFetch(`/api/v1/client-portal/workspaces/${workspaceId}/overview`, { method: "GET", cache: "no-store" });
        await assertApiResponseOk(response, "No se pudieron cargar los documentos");
        return response.json();
    },

    downloadInvoice: async (workspaceId: number, invoiceId: number): Promise<Blob> => {
        const response = await apiFetch(`/api/v1/client-portal/workspaces/${workspaceId}/invoices/${invoiceId}/pdf`, { method: "GET", cache: "no-store" });
        await assertApiResponseOk(response, "No se pudo descargar la factura");
        return response.blob();
    },

    acceptInspection: async (
        workspaceId: number,
        inspectionId: number,
        payload: ClientPortalInspectionAcceptancePayload,
    ): Promise<ClientPortalInspection> => {
        const response = await apiFetch(
            `/api/v1/client-portal/workspaces/${workspaceId}/inspections/${inspectionId}/acceptance`,
            { method: "POST", body: JSON.stringify(payload) },
        );
        await assertApiResponseOk(response, "No se pudo registrar la aceptación");
        return response.json();
    },

    getInvitations: async (clientId: number): Promise<ClientPortalInvitation[]> => {
        const response = await apiFetch(`/api/v1/client-portal/clients/${clientId}/invitations`, { method: "GET", cache: "no-store" });
        await assertApiResponseOk(response, "No se pudieron cargar las invitaciones");
        return response.json();
    },

    invite: async (clientId: number, email: string): Promise<ClientPortalInvitation> => {
        const response = await apiFetch(`/api/v1/client-portal/clients/${clientId}/invitations`, {
            method: "POST",
            body: JSON.stringify({ email }),
        });
        await assertApiResponseOk(response, "No se pudo enviar la invitación");
        return response.json();
    },

    revokeInvitation: async (clientId: number, invitationId: number): Promise<ClientPortalInvitation> => {
        const response = await apiFetch(`/api/v1/client-portal/clients/${clientId}/invitations/${invitationId}`, { method: "DELETE" });
        await assertApiResponseOk(response, "No se pudo revocar la invitación");
        return response.json();
    },

    getGrants: async (clientId: number): Promise<ClientPortalGrant[]> => {
        const response = await apiFetch(`/api/v1/client-portal/clients/${clientId}/grants`, { method: "GET", cache: "no-store" });
        await assertApiResponseOk(response, "No se pudieron cargar los accesos");
        return response.json();
    },

    revokeGrant: async (clientId: number, grantId: number): Promise<ClientPortalGrant> => {
        const response = await apiFetch(`/api/v1/client-portal/clients/${clientId}/grants/${grantId}`, { method: "DELETE" });
        await assertApiResponseOk(response, "No se pudo revocar el acceso");
        return response.json();
    },

    acceptInvitation: async (payload: ClientPortalInvitationAcceptPayload): Promise<void> => {
        const response = await apiFetch("/api/v1/client-portal/invitations/accept", {
            method: "POST",
            body: JSON.stringify(payload),
        });
        await assertApiResponseOk(response, "No se pudo activar el portal de cliente");
    },
};
