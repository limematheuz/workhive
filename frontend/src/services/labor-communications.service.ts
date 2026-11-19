import { apiFetch, assertApiResponseOk } from "@/lib/api";
import { documentRegister, type RegisteredDocument } from "./document-register.service";

export type LaborKind = "hire" | "termination" | "contract_change" | "other";
export type LaborState = "sent" | "received" | "processing" | "completed" | "rejected" | "cancelled";
export const laborKinds: { value: LaborKind; label: string }[] = [
    { value: "hire", label: "Alta" },
    { value: "termination", label: "Baja" },
    { value: "contract_change", label: "Cambio contractual" },
    { value: "other", label: "Otra comunicación" },
];
export const laborStates: Record<LaborState, string> = {
    sent: "Pendiente de recepción",
    received: "Recibida",
    processing: "En tramitación",
    completed: "Tramitada",
    rejected: "Devuelta",
    cancelled: "Cancelada",
};
export type LaborCommunication = { id: number; employee_id: number; employee_name: string; recipient_user_id: number; kind: LaborKind; effective_on: string; subject: string; description: string; status: LaborState; revision: number; created_at: string; documents: { revision_id: number; document_id: number; title: string; revision: number; download_url: string }[]; events: { id: number; status: LaborState; note: string; actor_name: string; created_at: string }[] };
export type LaborCommunicationWorkspace = { items: LaborCommunication[]; employees: { id: number; name: string }[]; recipients: { id: number; name: string; email: string }[]; can_create: boolean; can_review: boolean; has_more: boolean; offset: number };
export type LaborCommunicationInput = { employee_id: number; recipient_user_id: number; kind: LaborKind; effective_on: string; subject: string; description: string; document_revision_ids: number[] };
export type LaborDocument = RegisteredDocument;

async function request<T>(path: string, body?: unknown): Promise<T> {
    const response = await apiFetch(path, { ...(body === undefined ? { cache: "no-store" } : { method: "POST", body: JSON.stringify(body) }) });
    await assertApiResponseOk(response, "No se pudo completar la comunicación laboral.");
    return response.json();
}
export const laborCommunications = {
    read: (company: number, offset = 0) => request<LaborCommunicationWorkspace>(`/api/v1/labor-communications/${company}?offset=${offset}`),
    create: (company: number, body: LaborCommunicationInput) => request<LaborCommunication>(`/api/v1/labor-communications/${company}`, body),
    decide: (company: number, row: LaborCommunication, status: LaborState, note: string) => request<LaborCommunication>(`/api/v1/labor-communications/${company}/${row.id}/status`, { expected_revision: row.revision, status, note }),
    documents: (company: number, employee: number, search = "") => documentRegister.list({ company_id: company, owner_type: "staff", owner_id: employee, search }),
    linkDocument: (row: LaborDocument) => { if (!row.source_type || !row.source_id) throw new Error("Fuente documental no válida."); return documentRegister.link({ source_type: row.source_type, source_id: row.source_id }); },
};
