import { apiFetch, assertApiResponseOk } from "@/lib/api";
import { normalizeLocationMargin, type ApiLocationMargin } from "@/lib/margin-forecast";
import type { LocationMargin } from "@/types/margin-forecast";

export const LocationMarginService = {
    get: async (locationId: number): Promise<LocationMargin> => {
        const response = await apiFetch(`/api/v1/margin-forecasts/locations/${locationId}`, {
            method: "GET",
            cache: "no-store",
        });
        await assertApiResponseOk(response, "No se pudo cargar el margen de la ubicación");
        return normalizeLocationMargin(await response.json() as ApiLocationMargin);
    },
};
