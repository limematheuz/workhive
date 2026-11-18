import { apiFetch, assertApiResponseOk } from "@/lib/api";

export type DocumentOwnerType = "client" | "location" | "staff";
export type DocumentOwner = { id: number; name: string; can_manage: boolean };
export type DocumentSignature = { id: number; user_id?: number; user_name?: string | null; signer_name: string; signed_at: string; revision_hash: string; statement_version: string };
export type DocumentRevision = { id: number | null; revision: number; title: string; file_name: string; content_type: string; size_bytes: number; sha256: string; revision_hash: string | null; expires_on: string | null; expired: boolean; created_at: string; download_url: string; signatures: DocumentSignature[] };
export type RegisteredDocument = {
    id: number | null; source_type: "staff_file" | "location_document" | null; source_id: number | null;
    owner_type: DocumentOwnerType; owner_id: number; owner_name: string; title: string; document_type: string;
    published_revision: number | null; current: DocumentRevision | null; can_manage: boolean; can_sign: boolean; can_publish?: boolean;
};
export type DocumentRegisterWorkspace = { owners: { clients: DocumentOwner[]; locations: DocumentOwner[]; staff: DocumentOwner[] }; records: RegisteredDocument[]; has_more: boolean; offset: number; statement: string };
export type PortalDocumentWorkspace = Pick<DocumentRegisterWorkspace, "records" | "has_more" | "offset" | "statement">;
export type DocumentRegisterParams = { owner_type?: DocumentOwnerType; owner_id?: number; search?: string; company_id?: number; offset?: number };
export type DocumentSignInput = { expected_revision: number; expected_hash: string; signer_name: string; confirmed: true };
export type DocumentPublicationInput = { revision_id: number | null; expected_hash?: string };

async function request<T>(path: string, body?: object | FormData): Promise<T> {
    const response = await apiFetch("/api/v1/" + path, body === undefined ? { cache: "no-store" } : { method: "POST", body: body instanceof FormData ? body : JSON.stringify(body) });
    await assertApiResponseOk(response, "No se pudo consultar o guardar el documento. Revisa el acceso y la revisión actual.");
    return response.json();
}
export function safeDocumentDownloadUrl(value: string): string | null {
    return /^\/api\/v1\/(?:document-register\/\d+\/revisions\/\d+|client-portal\/workspaces\/\d+\/documents\/\d+\/revisions\/\d+|staff-files\/\d+|locations\/\d+\/documents\/\d+)\/download$/.test(value) ? value : null;
}
export const documentRegister = {
    list(params: DocumentRegisterParams = {}) {
        const query = new URLSearchParams();
        for (const [key, value] of Object.entries(params)) if (value !== undefined && value !== "") query.set(key, String(value));
        return request<DocumentRegisterWorkspace>("document-register" + (query.size ? "?" + query : ""));
    },
    link(body: { source_type: "staff_file" | "location_document"; source_id: number }) { return request<RegisteredDocument>("document-register/link", body); },
    create(body: FormData) { return request<RegisteredDocument>("document-register", body); },
    addRevision(id: number, body: FormData) { return request<RegisteredDocument>(`document-register/${id}/revisions`, body); },
    versions(id: number) { return request<DocumentRevision[]>(`document-register/${id}/revisions`); },
    sign(id: number, revisionId: number, body: DocumentSignInput) { return request<RegisteredDocument>(`document-register/${id}/revisions/${revisionId}/sign`, body); },
    publication(id: number, body: DocumentPublicationInput) { return request<RegisteredDocument>(`document-register/${id}/publication`, body); },
    portalList(grant: number, offset = 0) { return request<PortalDocumentWorkspace>(`client-portal/workspaces/${grant}/documents?offset=${offset}`); },
    portalSign(grant: number, id: number, revisionId: number, body: DocumentSignInput) { return request<RegisteredDocument>(`client-portal/workspaces/${grant}/documents/${id}/revisions/${revisionId}/sign`, body); },
    async download(url: string) {
        const safe = safeDocumentDownloadUrl(url);
        if (!safe) throw new Error("El enlace de descarga no corresponde a un documento privado autorizado.");
        const response = await apiFetch(safe, { cache: "no-store" });
        await assertApiResponseOk(response, "No se pudo descargar esta revisión del documento.");
        return response.blob();
    },
};
