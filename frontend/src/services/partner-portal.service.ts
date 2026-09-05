import { ApiResponseError, apiFetch, extractErrorMessage } from "@/lib/api";
import type { Location } from "@/types/location";
import type { Reservation } from "@/types/reservation";
import type { LocationCatalog, LocationProfileAttributeValue, LocationSpace } from "@/types/location";
import type { PartnerPortalCandidate, PartnerPortalGrant, PartnerPortalLocationInput, PartnerPortalLocationUpdate, PartnerPortalOverview, PartnerPortalReservationInput } from "@/types/partner-portal";

const PORTAL_WORKSPACE_ACCESS_MESSAGE = "Este acceso solo incluye el portal patrocinado. No tienes acceso al espacio completo de la empresa.";
const PORTAL_ACCESS_REVOKED_MESSAGE = "Tu acceso al portal ya no está activo. Contacta con la empresa que te invita.";
const PORTAL_PROPERTY_NOT_FOUND_MESSAGE = "No se ha encontrado la propiedad solicitada.";
const PORTAL_REQUEST_NOT_FOUND_MESSAGE = "No se ha encontrado la solicitud de limpieza.";
const PORTAL_MANAGEMENT_FORBIDDEN_MESSAGE = "No tienes permiso para gestionar este portal.";

async function extractPortalWorkspaceError(response: Response, fallback: string): Promise<string> {
    if (response.status === 402) return PORTAL_WORKSPACE_ACCESS_MESSAGE;
    if (response.status === 403) return PORTAL_ACCESS_REVOKED_MESSAGE;

    const detail = await extractErrorMessage(response, fallback);
    if (detail === "Property not found") return PORTAL_PROPERTY_NOT_FOUND_MESSAGE;
    if (detail === "Reservation not found") return PORTAL_REQUEST_NOT_FOUND_MESSAGE;
    if (detail === "This request is linked to started or invoiced work. Contact your service provider.") {
        return "Esta solicitud tiene trabajos iniciados o facturados. Contacta con tu empresa de limpieza para modificarla.";
    }
    if (detail === "This reservation overlaps another active reservation at the location") {
        return "Las fechas coinciden con otra estancia de esta propiedad. Revisa la entrada y la salida.";
    }
    if (detail === "The checkout date must be after the check-in date.") return "La salida debe ser posterior a la entrada.";
    if (response.status === 422) return "Revisa los campos del formulario: algún dato no es válido o falta por completar.";
    return fallback;
}

async function assertPortalWorkspaceResponse(response: Response, fallback: string): Promise<void> {
    if (response.ok) return;
    throw new ApiResponseError(
        await extractPortalWorkspaceError(response, fallback),
        response.status,
    );
}

async function extractPortalManagementError(response: Response, fallback: string): Promise<string> {
    if (response.status === 403) return PORTAL_MANAGEMENT_FORBIDDEN_MESSAGE;
    if (response.status === 404) return "No se ha encontrado la colaboración seleccionada.";
    if (response.status === 409) return "Esta empresa mantiene un espacio de pago y no puede usar el portal patrocinado.";
    if (response.status === 422) return "Selecciona una persona activa de la inmobiliaria.";
    return fallback;
}

async function assertPortalManagementResponse(response: Response, fallback: string): Promise<void> {
    if (response.ok) return;
    throw new ApiResponseError(
        await extractPortalManagementError(response, fallback),
        response.status,
    );
}

export const PartnerPortalService = {
    getOverview: async (): Promise<PartnerPortalOverview> => {
        const response = await apiFetch("/api/v1/partner-portal/overview", { method: "GET", cache: "no-store" });
        await assertPortalWorkspaceResponse(response, "No se pudo cargar el portal de colaboradores.");
        return response.json();
    },

    getLocations: async (): Promise<Location[]> => {
        const response = await apiFetch("/api/v1/partner-portal/locations", { method: "GET", cache: "no-store" });
        await assertPortalWorkspaceResponse(response, "No se pudieron cargar las propiedades.");
        return response.json();
    },

    createLocation: async (data: PartnerPortalLocationInput): Promise<Location> => {
        const response = await apiFetch("/api/v1/partner-portal/locations", {
            method: "POST",
            body: JSON.stringify(data),
        });
        await assertPortalWorkspaceResponse(response, "No se pudo crear la propiedad.");
        return response.json();
    },

    updateLocation: async (locationId: number, data: PartnerPortalLocationUpdate): Promise<Location> => {
        const response = await apiFetch(`/api/v1/partner-portal/locations/${locationId}`, {
            method: "PATCH",
            body: JSON.stringify(data),
        });
        await assertPortalWorkspaceResponse(response, "No se pudo actualizar la propiedad.");
        return response.json();
    },

    deleteLocation: async (locationId: number): Promise<void> => {
        const response = await apiFetch(`/api/v1/partner-portal/locations/${locationId}`, { method: "DELETE" });
        await assertPortalWorkspaceResponse(response, "No se pudo eliminar la propiedad.");
    },

    getLocationCatalog: async (): Promise<LocationCatalog> => {
        const response = await apiFetch("/api/v1/partner-portal/location-catalog", { method: "GET", cache: "no-store" });
        await assertPortalWorkspaceResponse(response, "No se pudo cargar el catálogo de propiedades.");
        return response.json();
    },

    getSpaceSuggestions: async (siteType: string, attributes: Record<string, LocationProfileAttributeValue>): Promise<LocationSpace[]> => {
        const response = await apiFetch("/api/v1/partner-portal/location-space-suggestions", {
            method: "POST",
            body: JSON.stringify({ site_type: siteType, attributes }),
        });
        await assertPortalWorkspaceResponse(response, "No se pudieron sugerir espacios.");
        return (await response.json() as { spaces: LocationSpace[] }).spaces;
    },

    getReservations: async (): Promise<Reservation[]> => {
        const response = await apiFetch("/api/v1/partner-portal/reservations", { method: "GET", cache: "no-store" });
        await assertPortalWorkspaceResponse(response, "No se pudieron cargar las solicitudes.");
        return response.json();
    },

    createReservation: async (data: PartnerPortalReservationInput): Promise<Reservation> => {
        const response = await apiFetch("/api/v1/partner-portal/reservations", {
            method: "POST",
            body: JSON.stringify({ ...data, cleaning_required: true }),
        });
        await assertPortalWorkspaceResponse(response, "No se pudo enviar la solicitud.");
        return response.json();
    },

    updateReservation: async (reservationId: number, data: Partial<PartnerPortalReservationInput>): Promise<Reservation> => {
        const response = await apiFetch(`/api/v1/partner-portal/reservations/${reservationId}`, {
            method: "PATCH",
            body: JSON.stringify({ ...data, cleaning_required: true }),
        });
        await assertPortalWorkspaceResponse(response, "No se pudo actualizar la solicitud.");
        return response.json();
    },

    deleteReservation: async (reservationId: number): Promise<void> => {
        const response = await apiFetch(`/api/v1/partner-portal/reservations/${reservationId}`, { method: "DELETE" });
        await assertPortalWorkspaceResponse(response, "No se pudo eliminar la solicitud.");
    },

    getCandidates: async (collaborationId: number): Promise<PartnerPortalCandidate[]> => {
        const response = await apiFetch(`/api/v1/partner-portal/collaborations/${collaborationId}/candidates`, { method: "GET", cache: "no-store" });
        await assertPortalManagementResponse(response, "No se pudieron cargar las personas de la inmobiliaria.");
        return response.json();
    },

    getGrants: async (collaborationId: number): Promise<PartnerPortalGrant[]> => {
        const response = await apiFetch(`/api/v1/partner-portal/collaborations/${collaborationId}/grants`, { method: "GET", cache: "no-store" });
        await assertPortalManagementResponse(response, "No se pudieron cargar los accesos al portal.");
        return response.json();
    },

    grantAccess: async (collaborationId: number, userId: number): Promise<PartnerPortalGrant> => {
        const response = await apiFetch(`/api/v1/partner-portal/collaborations/${collaborationId}/grants`, { method: "POST", body: JSON.stringify({ user_id: userId }) });
        await assertPortalManagementResponse(response, "No se pudo activar el portal.");
        return response.json();
    },

    revokeAccess: async (collaborationId: number, grantId: number): Promise<PartnerPortalGrant> => {
        const response = await apiFetch(`/api/v1/partner-portal/collaborations/${collaborationId}/grants/${grantId}`, { method: "DELETE" });
        await assertPortalManagementResponse(response, "No se pudo revocar el portal.");
        return response.json();
    },
};
