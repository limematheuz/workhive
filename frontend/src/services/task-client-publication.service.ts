import { apiFetch, assertApiResponseOk } from "@/lib/api";

export type PartChecklist = { reference?: string | null; text: string; completed: boolean; space_name: string | null };
export type PartReport = { reference?: string | null; kind: "issue" | "note" | "photo" | "checklist_note" | "checklist_photo"; title: string | null; text: string | null; checklist_label: string | null; created_at: string };
export type PartPhoto = { id: string; file_name: string; content_type: string; sha256: string; byte_size: number };
export type PartAcceptance = { revision: number; signer_name: string; accepted_at: string; statement_version: string };
export type PublishedWork = {
    id: number; revision: number; manifest_hash: string; published_at: string;
    manifest: { schema_version: 1; task_id: number; title: string; location_name: string; timezone: string; scheduled_start_at: string | null; started_at: string | null; completed_at: string; public_summary: string; checklist: PartChecklist[]; reports: PartReport[]; photos: PartPhoto[] };
    acceptance: PartAcceptance | null; previous_acceptances: PartAcceptance[];
};
export type PartCandidate = {
    task: { id: number; title: string; location_id: number; location_name: string; client_name: string | null; status: string; timezone: string; scheduled_start_at: string | null; started_at: string | null; completed_at: string | null };
    checklist_items: (PartChecklist & { id: number })[]; reports: (PartReport & { id: number; has_photo: boolean })[];
    source_hash: string; can_publish: boolean; blocked_reason: string | null; reports_has_more: boolean;
    latest_revision: number; is_public: boolean; latest: PublishedWork | null;
};
export type PublishPartInput = { public_summary: string; checklist_item_ids: number[]; report_ids: number[]; expected_revision: number; expected_source_hash: string; confirmed_publication: true };

async function request<T>(path: string, body?: unknown): Promise<T> {
    const response = await apiFetch("/api/v1/" + path, body ? { method: "POST", body: JSON.stringify(body) } : { cache: "no-store" });
    await assertApiResponseOk(response, "No se pudo consultar o actualizar el parte del cliente.");
    return response.json();
}
async function download(path: string): Promise<Blob> {
    const response = await apiFetch("/api/v1/" + path, { cache: "no-store" });
    await assertApiResponseOk(response, "No se pudo descargar el archivo privado del parte.");
    return response.blob();
}
const portalPath = (workspace: number) => `client-portal/workspaces/${workspace}/services`;
export const TaskClientPublicationService = {
    candidate: (task: number) => request<PartCandidate>(`task-client-publications/tasks/${task}`),
    publish: (task: number, body: PublishPartInput) => request<PartCandidate>(`task-client-publications/tasks/${task}`, body),
    revoke: (task: number, revision: number) => request<PartCandidate>(`task-client-publications/tasks/${task}/revoke`, { expected_revision: revision, confirmed: true }),
    sourcePhoto: (report: number) => download(`task-reports/${report}/media`),
    managerPhoto: (task: number, photo: string) => download(`task-client-publications/tasks/${task}/photos/${photo}`),
    managerPdf: (task: number) => download(`task-client-publications/tasks/${task}/pdf`),
    list: (workspace: number, offset = 0) => request<{ items: PublishedWork[]; has_more: boolean }>(portalPath(workspace) + `?offset=${offset}`),
    read: (workspace: number, publication: number) => request<PublishedWork>(portalPath(workspace) + `/${publication}`),
    history: (workspace: number, publication: number, offset = 0) => request<{ items: PartAcceptance[]; has_more: boolean }>(portalPath(workspace) + `/${publication}/history?offset=${offset}`),
    accept: (workspace: number, part: PublishedWork, signer: string) => request<PublishedWork>(portalPath(workspace) + `/${part.id}/acceptance`, { expected_revision: part.revision, expected_manifest_hash: part.manifest_hash, signer_name: signer, confirmed: true }),
    photo: (workspace: number, publication: number, photo: string) => download(portalPath(workspace) + `/${publication}/photos/${photo}`),
    pdf: (workspace: number, publication: number) => download(portalPath(workspace) + `/${publication}/pdf`),
};
