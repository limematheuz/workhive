import { apiFetch, assertApiResponseOk } from "@/lib/api";
import type {
    WorkOrder,
    WorkOrderContractCandidate,
    WorkOrderCreate,
} from "@/types/work-order";

export const WorkOrderService = {
    getWorkOrders: async (): Promise<WorkOrder[]> => {
        const response = await apiFetch("/api/v1/work-orders/", {
            method: "GET",
            cache: "no-store",
        });
        await assertApiResponseOk(response, "No se pudieron cargar las órdenes de trabajo.");
        return response.json();
    },

    getContractCandidates: async (): Promise<WorkOrderContractCandidate[]> => {
        const response = await apiFetch("/api/v1/work-orders/contract-candidates", {
            method: "GET",
            cache: "no-store",
        });
        await assertApiResponseOk(response, "No se pudieron cargar los contratos disponibles.");
        return response.json();
    },

    createWorkOrder: async (payload: WorkOrderCreate): Promise<WorkOrder> => {
        const response = await apiFetch("/api/v1/work-orders/", {
            method: "POST",
            body: JSON.stringify(payload),
        });
        await assertApiResponseOk(response, "No se pudo crear la orden de trabajo.");
        return response.json();
    },

    generateTask: async (id: number): Promise<{ work_order: WorkOrder; task_item_id: number }> => {
        const response = await apiFetch(`/api/v1/work-orders/${id}/generate`, {
            method: "POST",
        });
        await assertApiResponseOk(response, "No se pudo generar el trabajo.");
        return response.json();
    },
};
