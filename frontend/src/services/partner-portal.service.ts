import { apiFetch, assertApiResponseOk, extractErrorMessage } from "@/lib/api";
import type { Location } from "@/types/location";
import type { Reservation } from "@/types/reservation";
import type { PartnerPortalCandidate, PartnerPortalGrant, PartnerPortalOverview, PartnerPortalReservationInput } from "@/types/partner-portal";

export const PartnerPortalService = {
    getOverview: async (): Promise<PartnerPortalOverview> => {
        const response = await apiFetch("/api/v1/partner-portal/overview", { method: "GET", cache: "no-store" });
        await assertApiResponseOk(response, "No se pudo cargar el portal de colaboradores");
        return response.json();
    },

    getLocations: async (): Promise<Location[]> => {
        const response = await apiFetch("/api/v1/partner-portal/locations", { method: "GET", cache: "no-store" });
        await assertApiResponseOk(response, "No se pudieron cargar las propiedades");
        return response.json();
    },

    getReservations: async (): Promise<Reservation[]> => {
        const response = await apiFetch("/api/v1/partner-portal/reservations", { method: "GET", cache: "no-store" });
        await assertApiResponseOk(response, "No se pudieron cargar las solicitudes");
        return response.json();
    },

    createReservation: async (data: PartnerPortalReservationInput): Promise<Reservation> => {
        const response = await apiFetch("/api/v1/partner-portal/reservations", {
            method: "POST",
            body: JSON.stringify({ ...data, cleaning_required: true }),
        });
        if (!response.ok) {
            throw new Error(await extractErrorMessage(response, "No se pudo enviar la solicitud"));
        }
        return response.json();
    },

    getCandidates: async (collaborationId: number): Promise<PartnerPortalCandidate[]> => {
        const response = await apiFetch(`/api/v1/partner-portal/collaborations/${collaborationId}/candidates`, { method: "GET", cache: "no-store" });
        await assertApiResponseOk(response, "No se pudieron cargar las personas de la inmobiliaria");
        return response.json();
    },

    getGrants: async (collaborationId: number): Promise<PartnerPortalGrant[]> => {
        const response = await apiFetch(`/api/v1/partner-portal/collaborations/${collaborationId}/grants`, { method: "GET", cache: "no-store" });
        await assertApiResponseOk(response, "No se pudieron cargar los accesos al portal");
        return response.json();
    },

    grantAccess: async (collaborationId: number, userId: number): Promise<PartnerPortalGrant> => {
        const response = await apiFetch(`/api/v1/partner-portal/collaborations/${collaborationId}/grants`, { method: "POST", body: JSON.stringify({ user_id: userId }) });
        await assertApiResponseOk(response, "No se pudo activar el portal");
        return response.json();
    },

    revokeAccess: async (collaborationId: number, grantId: number): Promise<PartnerPortalGrant> => {
        const response = await apiFetch(`/api/v1/partner-portal/collaborations/${collaborationId}/grants/${grantId}`, { method: "DELETE" });
        await assertApiResponseOk(response, "No se pudo revocar el portal");
        return response.json();
    },
};
