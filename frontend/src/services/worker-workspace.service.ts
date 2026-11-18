import { apiFetch, assertApiResponseOk } from "@/lib/api";
export type WorkerContext = { employee: { id: number; name: string; position: string } | null; features: string[]; can_track_time:boolean };
export async function readWorkerContext(): Promise<WorkerContext> {
    const response = await apiFetch("/api/v1/worker-workspace", { cache: "no-store" });
    await assertApiResponseOk(response, "No se pudo comprobar tu acceso de trabajador.");
    return response.json();
}
