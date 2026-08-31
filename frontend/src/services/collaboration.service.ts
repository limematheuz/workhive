import { apiFetch, assertApiResponseOk } from "@/lib/api";
import {
    CompanyCollaboration,
    CompanyCollaborationInvitation,
} from "@/types/collaboration";
import { Company } from "@/types/company";

export const CollaborationService = {
    getCompanyInvitationActivationStatus: async (token: string): Promise<"requires_subscription" | "sign_in"> => {
        const response = await apiFetch("/api/v1/collaborations/invitations/activation-status", {
            method: "POST",
            body: JSON.stringify({ token }),
        });
        await assertApiResponseOk(response, "Could not read the company invitation");
        const data = await response.json() as { mode: "requires_subscription" | "sign_in" };
        return data.mode;
    },

    getSentCompanyInvitations: async (): Promise<CompanyCollaborationInvitation[]> => {
        const response = await apiFetch("/api/v1/collaborations/invitations/sent", {
            method: "GET",
            cache: "no-store",
        });
        await assertApiResponseOk(response, "Could not load company invitations");
        return response.json();
    },

    inviteCompanyByEmail: async (
        email: string,
        roleType: "service_provider" | "property_manager",
    ): Promise<void> => {
        const response = await apiFetch("/api/v1/collaborations/invitations", {
            method: "POST",
            body: JSON.stringify({ email, role_type: roleType }),
        });
        await assertApiResponseOk(response, "Could not send the company invitation");
    },

    verifyCompanyInvitationAccess: async (token: string): Promise<void> => {
        const response = await apiFetch("/api/v1/collaborations/invitations/verify-access", {
            method: "POST",
            body: JSON.stringify({ token }),
        });
        await assertApiResponseOk(response, "Could not verify the company invitation access");
    },

    verifyCompanyInvitationCode: async (
        token: string,
        verificationCode: string,
    ): Promise<string> => {
        const response = await apiFetch("/api/v1/collaborations/invitations/verify-code", {
            method: "POST",
            body: JSON.stringify({ token, verification_code: verificationCode }),
        });
        await assertApiResponseOk(response, "Could not verify the company invitation code");
        const data = await response.json() as { email: string };
        return data.email;
    },

    acceptCompanyInvitation: async (token: string, verificationCode: string): Promise<CompanyCollaboration> => {
        const response = await apiFetch("/api/v1/collaborations/invitations/accept", {
            method: "POST",
            body: JSON.stringify({ token, verification_code: verificationCode }),
        });
        await assertApiResponseOk(response, "Could not accept the company invitation");
        return response.json();
    },

    declineCompanyInvitation: async (token: string, verificationCode: string): Promise<void> => {
        const response = await apiFetch("/api/v1/collaborations/invitations/decline", {
            method: "POST",
            body: JSON.stringify({ token, verification_code: verificationCode }),
        });
        await assertApiResponseOk(response, "Could not decline the company invitation");
    },

    declineCompanyInvitationWithoutAccount: async (token: string, verificationCode: string): Promise<void> => {
        const response = await apiFetch("/api/v1/collaborations/invitations/decline-external", {
            method: "POST",
            body: JSON.stringify({ token, verification_code: verificationCode }),
        });
        await assertApiResponseOk(response, "Could not decline the company invitation");
    },

    revokeCompanyInvitation: async (id: number): Promise<void> => {
        const response = await apiFetch(`/api/v1/collaborations/invitations/${id}`, {
            method: "DELETE",
        });
        await assertApiResponseOk(response, "Could not revoke the company invitation");
    },

    getCollaborations: async (): Promise<CompanyCollaboration[]> => {
        const response = await apiFetch("/api/v1/collaborations/", {
            method: "GET",
            cache: "no-store",
        });
        await assertApiResponseOk(response, "No se pudieron cargar las colaboraciones");
        return await response.json();
    },

    getServiceProviders: async (): Promise<Company[]> => {
        const response = await apiFetch("/api/v1/collaborations/service-providers", {
            method: "GET",
            cache: "no-store",
        });
        await assertApiResponseOk(response, "No se pudieron cargar las empresas colaboradoras");
        return await response.json();
    },

    deleteCollaboration: async (id: number): Promise<void> => {
        const response = await apiFetch(`/api/v1/collaborations/${id}`, {
            method: "DELETE",
        });
        await assertApiResponseOk(response, "Could not remove the company collaboration");
    },
};
