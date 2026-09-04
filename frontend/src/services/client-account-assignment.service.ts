import { apiFetch, assertApiResponseOk } from "@/lib/api";
import type {
    ClientAccountAssignment,
    ClientAccountAssignmentCandidate,
    ClientPortfolioItem,
} from "@/types/client";

export const ClientAccountAssignmentService = {
    getMyPortfolio: async (): Promise<ClientPortfolioItem[]> => {
        const response = await apiFetch("/api/v1/clients/portfolio", {
            method: "GET",
            cache: "no-store",
        });
        await assertApiResponseOk(response, "No se pudo cargar tu cartera");
        return await response.json();
    },

    getCandidates: async (
        clientId: number,
    ): Promise<ClientAccountAssignmentCandidate[]> => {
        const response = await apiFetch(
            `/api/v1/clients/${clientId}/account-assignment/candidates`,
            {
                method: "GET",
                cache: "no-store",
            },
        );
        await assertApiResponseOk(response, "No se pudieron cargar las personas responsables");
        return await response.json();
    },

    replace: async (
        clientId: number,
        membershipId: number | null,
    ): Promise<ClientAccountAssignment | null> => {
        const response = await apiFetch(`/api/v1/clients/${clientId}/account-assignment`, {
            method: "PUT",
            body: JSON.stringify({ membership_id: membershipId }),
        });
        await assertApiResponseOk(response, "No se pudo actualizar la cartera comercial");
        return response.status === 204 ? null : await response.json();
    },
};
