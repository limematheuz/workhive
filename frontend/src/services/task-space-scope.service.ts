import { apiFetch, assertApiResponseOk } from "@/lib/api";
import type { SpaceAllocation, WorkforceChoices } from "@/services/service-planning.service";
import type { LocationSpace } from "@/types/location";

export type TaskSpaceScope = {
    task_id: number;
    location_id: number;
    scheduled_start_at: string | null;
    spaces: SpaceAllocation[];
    available_spaces: LocationSpace[];
    choices: WorkforceChoices;
    can_edit: boolean;
    blocked_reason: string | null;
};

export async function readTaskSpaceScope(taskId: number): Promise<TaskSpaceScope> {
    const response = await apiFetch(`/api/v1/workforce-execution/${taskId}/scope`, { cache: "no-store" });
    await assertApiResponseOk(response, "No se pudo consultar el reparto del trabajo.");
    return response.json();
}

export async function saveTaskSpaceScope(taskId: number, spaces: SpaceAllocation[]): Promise<TaskSpaceScope> {
    const response = await apiFetch(`/api/v1/workforce-execution/${taskId}/scope`, {
        method: "PUT", body: JSON.stringify({ spaces }),
    });
    await assertApiResponseOk(response, "No se pudo guardar el reparto del trabajo.");
    return response.json();
}
