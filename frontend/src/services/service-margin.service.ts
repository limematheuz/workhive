import { apiFetch, assertApiResponseOk } from "@/lib/api";
import { normalizeServiceMargin, type ApiServiceMargin } from "@/lib/margin-forecast";
import type { ServiceMargin, ServiceMarginScope } from "@/types/margin-forecast";

export const ServiceMarginService = {
    getScopes: async (): Promise<ServiceMarginScope[]> => {
        const response = await apiFetch("/api/v1/margin-forecasts/services", {
            method: "GET",
            cache: "no-store",
        });
        await assertApiResponseOk(response, "No se pudieron cargar los servicios");
        return await response.json() as ServiceMarginScope[];
    },

    get: async (serviceCatalogVersionId: number): Promise<ServiceMargin> => {
        const response = await apiFetch(
            `/api/v1/margin-forecasts/services/${serviceCatalogVersionId}`,
            { method: "GET", cache: "no-store" },
        );
        await assertApiResponseOk(response, "No se pudo cargar el margen del servicio");
        return normalizeServiceMargin(await response.json() as ApiServiceMargin);
    },
};
