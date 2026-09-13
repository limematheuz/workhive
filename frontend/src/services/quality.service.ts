import { apiFetch, assertApiResponseOk } from "@/lib/api";

export type QualityTemplateItem = {
    id: number;
    position: number;
    title: string;
    guidance: string | null;
    is_required: boolean;
    max_points: number;
};

export type QualityTemplate = {
    id: number;
    location_id: number | null;
    title: string;
    description: string | null;
    is_active: boolean;
    created_at: string;
    updated_at: string;
    items: QualityTemplateItem[];
};

export type QualityInspectionItem = QualityTemplateItem & {
    status: "not_assessed" | "passed" | "failed";
    points_awarded: number;
    notes: string | null;
};

export type QualityInspection = {
    id: number;
    location_id: number;
    template_id: number | null;
    template_title: string;
    status: "draft" | "completed";
    notes: string | null;
    created_at: string;
    completed_at: string | null;
    score: number;
    max_score: number;
    items: QualityInspectionItem[];
};

export type QualityCorrectiveAction = {
    id: number;
    title: string;
    description: string | null;
    status: "pending" | "completed" | "cancelled";
    due_at: string | null;
    completed_at: string | null;
};

export type QualityIncident = {
    id: number;
    location_id: number;
    inspection_id: number | null;
    inspection_item_id: number | null;
    title: string;
    description: string | null;
    severity: "low" | "medium" | "high" | "critical";
    status: "open" | "in_progress" | "resolved" | "closed";
    created_at: string;
    resolved_at: string | null;
    corrective_actions: QualityCorrectiveAction[];
};

async function request<T>(path: string, init: RequestInit = {}, message = "No se pudo completar la acción de calidad."): Promise<T> {
    const response = await apiFetch(`/api/v1/quality${path}`, init);
    await assertApiResponseOk(response, message);
    return response.json();
}

export const QualityService = {
    getTemplates: () => request<QualityTemplate[]>("/templates/", { cache: "no-store" }, "No se pudieron cargar las plantillas."),
    createTemplate: (payload: { location_id?: number; title: string; description?: string; items: Array<{ title: string; guidance?: string; is_required?: boolean; max_points: number }> }) => request<QualityTemplate>("/templates/", { method: "POST", body: JSON.stringify(payload) }, "No se pudo crear la plantilla."),
    getInspections: () => request<QualityInspection[]>("/inspections/", { cache: "no-store" }, "No se pudieron cargar las inspecciones."),
    createInspection: (payload: { template_id: number; location_id: number; notes?: string }) => request<QualityInspection>("/inspections/", { method: "POST", body: JSON.stringify(payload) }, "No se pudo iniciar la inspección."),
    completeInspection: (inspectionId: number, payload: { notes?: string; items: Array<{ id: number; status: QualityInspectionItem["status"]; points_awarded: number; notes?: string }> }) => request<QualityInspection>(`/inspections/${inspectionId}/complete`, { method: "POST", body: JSON.stringify(payload) }, "No se pudo cerrar la inspección."),
    getIncidents: () => request<QualityIncident[]>("/incidents/", { cache: "no-store" }, "No se pudieron cargar las incidencias."),
    createIncident: (payload: { location_id: number; title: string; description?: string; severity: QualityIncident["severity"]; inspection_id?: number; inspection_item_id?: number }) => request<QualityIncident>("/incidents/", { method: "POST", body: JSON.stringify(payload) }, "No se pudo registrar la incidencia."),
    createCorrectiveAction: (incidentId: number, payload: { title: string; description?: string; due_at?: string }) => request<QualityCorrectiveAction>(`/incidents/${incidentId}/actions`, { method: "POST", body: JSON.stringify(payload) }, "No se pudo crear la acción correctiva."),
    updateCorrectiveAction: (incidentId: number, actionId: number, payload: { title?: string; description?: string | null; due_at?: string | null; status?: QualityCorrectiveAction["status"] }) => request<QualityCorrectiveAction>(`/incidents/${incidentId}/actions/${actionId}`, { method: "PATCH", body: JSON.stringify(payload) }, "No se pudo actualizar la acción correctiva."),
};
