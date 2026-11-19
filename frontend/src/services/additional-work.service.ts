import {apiFetch, assertApiResponseOk} from "@/lib/api";

export type AdditionalWork = {
    id: number; title: string; description: string; location_id: number;
    quote_id: number | null; contract_id: number | null; task_id: number | null; stage: string;
};
const base = "/api/v1/additional-work";

export async function readAdditionalWork(): Promise<AdditionalWork[]> {
    const response = await apiFetch(base, {cache: "no-store"});
    await assertApiResponseOk(response, "No se pudieron cargar las peticiones.");
    return response.json();
}
export async function saveAdditionalWork(id: number | null, action: "quote" | "schedule" | "", body: object): Promise<AdditionalWork> {
    const response = await apiFetch(id === null ? base : base + "/" + id + "/" + action, {
        method: action === "quote" ? "PUT" : "POST", body: JSON.stringify(body),
    });
    await assertApiResponseOk(response, "No se pudo guardar la petición.");
    return response.json();
}
