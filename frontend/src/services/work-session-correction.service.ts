import { apiFetch, extractErrorMessage } from "@/lib/api";
import type {
    WorkSessionCorrection,
    WorkSessionCorrectionCreate,
    WorkSessionCorrectionReview,
} from "@/types/work-session-correction";

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const response = await apiFetch(`/api/v1/work-session-corrections${path}`, init);
    if (!response.ok) {
        throw new Error(await extractErrorMessage(response, "No se pudo actualizar el fichaje."));
    }
    return response.json() as Promise<T>;
}

export const WorkSessionCorrectionService = {
    getOwn: () => request<WorkSessionCorrection[]>("/", { cache: "no-store" }),
    getReviewQueue: () => request<WorkSessionCorrection[]>("/?review_queue=true", { cache: "no-store" }),
    requestCorrection: (workSessionId: number, payload: WorkSessionCorrectionCreate) =>
        request<WorkSessionCorrection>(`/sessions/${workSessionId}`, {
            method: "POST",
            body: JSON.stringify(payload),
        }),
    reviewCorrection: (correctionId: number, payload: WorkSessionCorrectionReview) =>
        request<WorkSessionCorrection>(`/${correctionId}/review`, {
            method: "POST",
            body: JSON.stringify(payload),
        }),
};
