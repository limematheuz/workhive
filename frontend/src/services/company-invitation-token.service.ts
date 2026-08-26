const COMPANY_INVITATION_TOKEN_ROUTE = "/api/company-invitation-token";

export const companyInvitationTokenService = {
    persist: async (token: string): Promise<void> => {
        const response = await fetch(COMPANY_INVITATION_TOKEN_ROUTE, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ token }),
        });
        if (!response.ok) throw new Error("Could not retain invitation token");
    },

    clear: async (): Promise<void> => {
        await fetch(COMPANY_INVITATION_TOKEN_ROUTE, { method: "DELETE" });
    },
};
