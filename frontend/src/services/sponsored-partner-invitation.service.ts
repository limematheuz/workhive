import { apiFetch, assertApiResponseOk } from "@/lib/api";
import type {
    SponsoredPartnerInvitation,
    SponsoredPartnerInvitationAcceptPayload,
} from "@/types/sponsored-partner-invitation";

export const sponsoredPartnerInvitationService = {
    getSent: async (): Promise<SponsoredPartnerInvitation[]> => {
        const response = await apiFetch("/api/v1/collaborations/sponsored-invitations/sent", {
            method: "GET",
            cache: "no-store",
        });
        await assertApiResponseOk(response, "Could not load sponsored property manager invitations");
        return response.json();
    },

    invite: async (email: string, companyName: string): Promise<void> => {
        const response = await apiFetch("/api/v1/collaborations/sponsored-invitations", {
            method: "POST",
            body: JSON.stringify({ email, company_name: companyName }),
        });
        await assertApiResponseOk(response, "Could not send sponsored property manager invitation");
    },

    revoke: async (invitationId: number): Promise<void> => {
        const response = await apiFetch(`/api/v1/collaborations/sponsored-invitations/${invitationId}`, {
            method: "DELETE",
        });
        await assertApiResponseOk(response, "Could not revoke sponsored property manager invitation");
    },

    accept: async (payload: SponsoredPartnerInvitationAcceptPayload): Promise<void> => {
        const response = await apiFetch("/api/v1/collaborations/sponsored-invitations/accept", {
            method: "POST",
            body: JSON.stringify(payload),
        });
        await assertApiResponseOk(response, "Could not create sponsored property manager portal");
    },
};
