import { apiFetch, assertApiResponseOk } from "@/lib/api";
import { compressImageForUpload } from "@/lib/image";
import type { LocationDocument, LocationDocumentLibraryItem } from "@/types/location";

export type { LocationDocument, LocationDocumentLibraryItem } from "@/types/location";

export const LocationDocumentService = {
    getDocuments: async (locationId: number): Promise<LocationDocument[]> => {
        const response = await apiFetch(`/api/v1/locations/${locationId}/documents`, {
            method: "GET",
            cache: "no-store",
        });
        await assertApiResponseOk(response, "No se pudieron cargar los documentos.");
        return response.json();
    },

    getDocumentLibrary: async (): Promise<LocationDocumentLibraryItem[]> => {
        const response = await apiFetch("/api/v1/location-documents", {
            method: "GET",
            cache: "no-store",
        });
        await assertApiResponseOk(response, "No se pudieron cargar los documentos.");
        return response.json();
    },

    uploadDocument: async (
        locationId: number,
        file: File,
        documentType = "other",
    ): Promise<LocationDocument> => {
        const uploadFile = file.type.startsWith("image/")
            ? await compressImageForUpload(file)
            : file;
        const body = new FormData();
        body.append("file", uploadFile);
        body.append("document_type", documentType);
        const response = await apiFetch(`/api/v1/locations/${locationId}/documents`, {
            method: "POST",
            body,
        });
        await assertApiResponseOk(response, "No se pudo subir el documento.");
        return response.json();
    },

    archiveDocument: async (locationId: number, documentId: number): Promise<void> => {
        const response = await apiFetch(`/api/v1/locations/${locationId}/documents/${documentId}`, {
            method: "DELETE",
        });
        await assertApiResponseOk(response, "No se pudo archivar el documento.");
    },

    documentDownloadUrl: (locationId: number, documentId: number) => (
        `/api/v1/locations/${locationId}/documents/${documentId}/download`
    ),
};
