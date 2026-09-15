import { apiFetch, assertApiResponseOk } from "@/lib/api";
import { normalizeMarginForecast, type ApiMarginForecast } from "@/lib/margin-forecast";
import type { MarginForecast, MarginForecastPayload, MarginForecastScopeType } from "@/types/margin-forecast";

function path(scopeType: MarginForecastScopeType, scopeId: number): string {
    const resource = scopeType === "contract" ? "contracts" : "work-orders";
    return `/api/v1/margin-forecasts/${resource}/${scopeId}`;
}

async function request(
    scopeType: MarginForecastScopeType,
    scopeId: number,
    init: RequestInit,
): Promise<MarginForecast> {
    const response = await apiFetch(path(scopeType, scopeId), init);
    await assertApiResponseOk(response, "No se pudo cargar el margen previsto");
    return normalizeMarginForecast(await response.json() as ApiMarginForecast);
}

export const MarginForecastService = {
    get: (scopeType: MarginForecastScopeType, scopeId: number) => request(scopeType, scopeId, {
        method: "GET",
        cache: "no-store",
    }),
    save: (scopeType: MarginForecastScopeType, scopeId: number, payload: MarginForecastPayload) => request(scopeType, scopeId, {
        method: "PUT",
        body: JSON.stringify(payload),
    }),
};
