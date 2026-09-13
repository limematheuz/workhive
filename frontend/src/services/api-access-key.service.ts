import { apiFetch, assertApiResponseOk } from "@/lib/api";
import type { ApiAccessKey, ApiAccessKeyUsage, ApiAccessScope, CreatedApiAccessKey } from "@/types/api-access-key";

export const ApiAccessKeyService = {
    list: async (): Promise<ApiAccessKey[]> => {
        const response = await apiFetch("/api/v1/api-access-keys/", { method: "GET", cache: "no-store" });
        await assertApiResponseOk(response, "No se pudieron cargar las claves API");
        return response.json();
    },

    create: async (name: string, scopes: ApiAccessScope[]): Promise<CreatedApiAccessKey> => {
        const response = await apiFetch("/api/v1/api-access-keys/", {
            method: "POST",
            body: JSON.stringify({ name, scopes }),
        });
        await assertApiResponseOk(response, "No se pudo crear la clave API");
        return response.json();
    },

    revoke: async (keyId: number): Promise<ApiAccessKey> => {
        const response = await apiFetch(`/api/v1/api-access-keys/${keyId}/revoke`, { method: "POST" });
        await assertApiResponseOk(response, "No se pudo revocar la clave API");
        return response.json();
    },

    listUsage: async (keyId: number): Promise<ApiAccessKeyUsage[]> => {
        const response = await apiFetch(`/api/v1/api-access-keys/${keyId}/usage?limit=50`, {
            method: "GET",
            cache: "no-store",
        });
        await assertApiResponseOk(response, "No se pudo cargar el historial de la clave API");
        return response.json();
    },
};
