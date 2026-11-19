import { apiFetch, assertApiResponseOk } from "@/lib/api";
import { isWorkspaceSearchHref, type WorkspaceSearchResult } from "@/lib/workspace-search";

export const workspaceSearchService = {
    async search(query: string, companyId: number, signal?: AbortSignal): Promise<WorkspaceSearchResult> {
        const params = new URLSearchParams({ q: query, limit_per_type: "5" });
        const response = await apiFetch(`/api/v1/workspace-search?${params}`, { cache: "no-store", signal });
        await assertApiResponseOk(response, "No se pudo realizar la búsqueda.");
        const result = await response.json() as WorkspaceSearchResult;
        if (result.company_id !== companyId || !Array.isArray(result.groups) || !Array.isArray(result.navigation)) {
            throw new Error("La empresa activa ha cambiado. Vuelve a realizar la búsqueda.");
        }
        return {
            ...result,
            groups: result.groups.map(group => ({ ...group, items: group.items.filter(item => isWorkspaceSearchHref(item.href)) })),
            navigation: result.navigation.filter(item => isWorkspaceSearchHref(item.href)),
        };
    },
};
