import { apiFetch, assertApiResponseOk } from "@/lib/api";
import { clearSessionCache } from "@/lib/auth";
import { readApplicationWorkspace, resolveApplicationSwitchTarget, type ApplicationAccess, type ApplicationWorkspace } from "@/lib/application-access";

export const applicationSession = {
    async list(): Promise<ApplicationWorkspace | null> {
        const response = await apiFetch("/api/v1/session/applications", { method: "GET", cache: "no-store" });
        if (response.status === 401) return null;
        await assertApiResponseOk(response, "No se pudieron cargar tus accesos.");
        return readApplicationWorkspace(await response.json());
    },
    async change(chosen: ApplicationAccess): Promise<string> {
        const response = await apiFetch("/api/v1/session/applications/switch", {
            method: "POST", body: JSON.stringify({ key: chosen.key }),
        });
        await assertApiResponseOk(response, "No se pudo cambiar de aplicación.");
        const target = resolveApplicationSwitchTarget(chosen, await response.json());
        // Hard navigation drops reads from the previous context. Pending worker
        // parts remain owned by this identity and company in IndexedDB.
        clearSessionCache();
        return target;
    },
};
