import { apiFetch, assertApiResponseOk } from "@/lib/api";
import { normalizeTeamLaborCost, type ApiTeamLaborCost } from "@/lib/margin-forecast";
import type { TeamLaborCost } from "@/types/margin-forecast";

export const TeamLaborCostService = {
    getSummaries: async (): Promise<TeamLaborCost[]> => {
        const response = await apiFetch("/api/v1/margin-forecasts/teams", {
            method: "GET",
            cache: "no-store",
        });
        await assertApiResponseOk(response, "No se pudieron cargar los costes por equipo");
        return (await response.json() as ApiTeamLaborCost[]).map(normalizeTeamLaborCost);
    },
};
