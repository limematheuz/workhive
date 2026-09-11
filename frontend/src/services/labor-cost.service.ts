import { apiFetch, assertApiResponseOk } from "@/lib/api";

export type LaborCostRate = {
    id: number;
    company_membership_id: number;
    member_name: string | null;
    hourly_cost: string;
    effective_on: string;
    created_at: string;
};

export type LaborCostSummary = {
    user_id: number;
    member_name: string;
    session_count: number;
    total_cost: string;
};

export const LaborCostService = {
    getRates: async (): Promise<LaborCostRate[]> => {
        const response = await apiFetch("/api/v1/labor-costs/rates", { cache: "no-store" });
        await assertApiResponseOk(response, "No se pudieron cargar los costes laborales.");
        return response.json();
    },
    createRate: async (payload: {
        company_membership_id: number;
        hourly_cost: string;
        effective_on: string;
    }): Promise<LaborCostRate> => {
        const response = await apiFetch("/api/v1/labor-costs/rates", {
            method: "POST",
            body: JSON.stringify(payload),
        });
        await assertApiResponseOk(response, "No se pudo guardar el coste laboral.");
        return response.json();
    },
    getSummary: async (startOn?: string, endOn?: string): Promise<LaborCostSummary[]> => {
        const query = new URLSearchParams();
        if (startOn) query.set("start_on", startOn);
        if (endOn) query.set("end_on", endOn);
        const response = await apiFetch(`/api/v1/labor-costs/summary${query.size ? `?${query}` : ""}`, { cache: "no-store" });
        await assertApiResponseOk(response, "No se pudo cargar el resumen de costes laborales.");
        return response.json();
    },
};
