import { apiFetch, assertApiResponseOk } from "@/lib/api";
import type {
    WorkOrder,
    WorkOrderContractCandidate,
    WorkOrderCreate,
    WorkOrderUpdate,
} from "@/types/work-order";
import type {
    InventoryMovement,
    InventoryWorkOrderConsumptionInput,
} from "@/types/inventory";

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

    updateWorkOrder: async (id: number, payload: WorkOrderUpdate): Promise<WorkOrder> => {
        const response = await apiFetch(`/api/v1/work-orders/${id}`, {
            method: "PATCH",
            body: JSON.stringify(payload),
        });
        await assertApiResponseOk(response, "No se pudo actualizar la orden de trabajo.");
        return response.json();
    },

    generateTask: async (id: number): Promise<{ work_order: WorkOrder; task_item_id: number }> => {
        const response = await apiFetch(`/api/v1/work-orders/${id}/generate`, {
            method: "POST",
        });
        await assertApiResponseOk(response, "No se pudo generar el trabajo.");
        return response.json();
    },

    getMaterialConsumptions: async (id: number): Promise<InventoryMovement[]> => {
        const response = await apiFetch(`/api/v1/work-orders/${id}/materials`, {
            method: "GET",
            cache: "no-store",
        });
        await assertApiResponseOk(response, "No se pudieron cargar los consumos de material.");
        return response.json();
    },

    consumeMaterial: async (id: number, payload: InventoryWorkOrderConsumptionInput): Promise<InventoryMovement> => {
        const response = await apiFetch(`/api/v1/work-orders/${id}/materials`, {
            method: "POST",
            body: JSON.stringify(payload),
        });
        await assertApiResponseOk(response, "No se pudo registrar el consumo de material.");
        return response.json();
    },

    reverseMaterialConsumption: async (id: number, movementId: number, reason: string): Promise<InventoryMovement> => {
        const response = await apiFetch(`/api/v1/work-orders/${id}/materials/${movementId}/reverse`, {
            method: "POST",
            body: JSON.stringify({ reason }),
        });
        await assertApiResponseOk(response, "No se pudo corregir el consumo de material.");
        return response.json();
    },
};
