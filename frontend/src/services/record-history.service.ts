import { apiFetch, assertApiResponseOk } from "@/lib/api";
export type RecordEntity = "client" | "location" | "staff_employee" | "quote" | "service_contract" | "work_order" | "task_item" | "invoice" | "expense" | "company_membership" | "permission_profile";
export type RecordChange = { field: string; label: string; before: string | null; after: string | null; before_known: boolean };
export type RecordHistoryPage = { items: { id: number; occurred_at: string; actor_name: string; action: string; changes: RecordChange[]; fields: string[] }[]; has_more: boolean };
export async function readRecordHistory(entityType: RecordEntity, entityId: number, offset = 0): Promise<RecordHistoryPage> {
    const response = await apiFetch("/api/v1/record-history/" + entityType + "/" + entityId + "?offset=" + offset, { cache: "no-store" });
    await assertApiResponseOk(response, "No se pudo consultar el historial de esta ficha.");
    return response.json();
}
