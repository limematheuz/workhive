import { apiFetch, extractErrorMessage } from "@/lib/api";

export type TrialRequest = {
    id: number;
    full_name: string;
    email: string;
    company_name: string;
    phone?: string | null;
    message?: string | null;
    status: string;
    requested_trial_days?: number | null;
    approved_trial_days?: number | null;
    approval_mode?: string | null;
    decision_note?: string | null;
    email_verified_at?: string | null;
    approved_at?: string | null;
    rejected_at?: string | null;
    created_company_id?: number | null;
    created_user_id?: number | null;
    created_at: string;
    updated_at: string;
};

export type TrialRequestCreate = {
    full_name: string;
    email: string;
    company_name: string;
    phone?: string;
    message?: string;
    requested_trial_days?: number;
    website?: string;
};

export type TrialRequestApprove = {
    access_mode: "trial" | "basic" | "medium" | "top" | "mega" | "custom";
    trial_days?: number;
    tax_id: string;
    address: string;
    phone: string;
    company_email?: string;
    owner_full_name?: string;
    note?: string;
};

export const TrialRequestService = {
    create: async (data: TrialRequestCreate): Promise<void> => {
        const response = await apiFetch("/api/v1/trial-requests/", {
            method: "POST",
            body: JSON.stringify(data),
        });
        if (!response.ok) {
            throw new Error(await extractErrorMessage(response, "No se pudo solicitar la prueba"));
        }
    },

    verify: async (token: string): Promise<{ status: string }> => {
        const response = await apiFetch(`/api/v1/trial-requests/verify`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ token }),
        });
        if (!response.ok) {
            throw new Error(await extractErrorMessage(response, "No se pudo verificar la solicitud"));
        }
        return await response.json();
    },

    list: async (): Promise<TrialRequest[]> => {
        const response = await apiFetch("/api/v1/trial-requests/", {
            method: "GET",
            cache: "no-store",
        });
        if (!response.ok) {
            throw new Error(await extractErrorMessage(response, "No se pudieron cargar las solicitudes"));
        }
        return await response.json();
    },

    approve: async (id: number, data: TrialRequestApprove): Promise<TrialRequest> => {
        const response = await apiFetch(`/api/v1/trial-requests/${id}/approve`, {
            method: "POST",
            body: JSON.stringify(data),
        });
        if (!response.ok) {
            throw new Error(await extractErrorMessage(response, "No se pudo aprobar la solicitud"));
        }
        return await response.json();
    },

    reject: async (id: number, note?: string): Promise<TrialRequest> => {
        const response = await apiFetch(`/api/v1/trial-requests/${id}/reject`, {
            method: "POST",
            body: JSON.stringify({ note }),
        });
        if (!response.ok) {
            throw new Error(await extractErrorMessage(response, "No se pudo rechazar la solicitud"));
        }
        return await response.json();
    },
};
