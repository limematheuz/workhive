import { apiFetch, extractErrorMessage } from "@/lib/api";
import type {
    LocationBulkImportPreview,
    LocationBulkImportResult,
    LocationCatalog,
    LocationProfileAttributeValue,
    LocationSpace,
    LocationSpaceTask,
} from "@/types/location";

export const LocationWorkspaceService = {
    getLocationCatalog: async (): Promise<LocationCatalog> => {
        const response = await apiFetch("/api/v1/locations/catalog", {
            method: "GET",
            cache: "no-store",
        });
        if (!response.ok) {
            throw new Error(await extractErrorMessage(response, "Error fetching location catalog"));
        }
        return await response.json();
    },

    getSpaceSuggestions: async (
        siteType: string,
        attributes: Record<string, LocationProfileAttributeValue>,
    ): Promise<LocationSpace[]> => {
        const response = await apiFetch("/api/v1/locations/space-suggestions", {
            method: "POST",
            body: JSON.stringify({ site_type: siteType, attributes }),
        });
        if (!response.ok) {
            throw new Error(await extractErrorMessage(response, "Error suggesting location spaces"));
        }
        const data = await response.json() as { spaces: LocationSpace[] };
        return data.spaces;
    },

    getSpaces: async (locationId: number): Promise<LocationSpace[]> => {
        const response = await apiFetch(`/api/v1/locations/${locationId}/spaces`, {
            method: "GET",
            cache: "no-store",
        });
        if (!response.ok) {
            throw new Error(await extractErrorMessage(response, "Error fetching location spaces"));
        }
        return await response.json();
    },

    reorderSpaces: async (locationId: number, spaceIds: number[]): Promise<void> => {
        const response = await apiFetch(`/api/v1/locations/${locationId}/spaces/order`, {
            method: "PUT",
            body: JSON.stringify({ space_ids: spaceIds }),
        });
        if (!response.ok) {
            throw new Error(await extractErrorMessage(response, "Error reordering location spaces"));
        }
    },

    createSpace: async (
        locationId: number,
        data: Omit<LocationSpace, "id" | "location_id" | "sort_order" | "is_active">,
    ): Promise<LocationSpace> => {
        const response = await apiFetch(`/api/v1/locations/${locationId}/spaces`, {
            method: "POST",
            body: JSON.stringify(data),
        });
        if (!response.ok) {
            throw new Error(await extractErrorMessage(response, "Error creating location space"));
        }
        return await response.json();
    },

    archiveSpace: async (locationId: number, spaceId: number): Promise<void> => {
        const response = await apiFetch(`/api/v1/locations/${locationId}/spaces/${spaceId}`, {
            method: "DELETE",
        });
        if (!response.ok) {
            throw new Error(await extractErrorMessage(response, "Error archiving location space"));
        }
    },

    createSpaceTask: async (
        locationId: number,
        spaceId: number,
        data: Omit<LocationSpaceTask, "id" | "sort_order" | "is_active">,
    ): Promise<LocationSpaceTask> => {
        const response = await apiFetch(
            `/api/v1/locations/${locationId}/spaces/${spaceId}/tasks`,
            { method: "POST", body: JSON.stringify(data) },
        );
        if (!response.ok) {
            throw new Error(await extractErrorMessage(response, "Error creating space task"));
        }
        return await response.json();
    },

    archiveSpaceTask: async (
        locationId: number,
        spaceId: number,
        taskId: number,
    ): Promise<void> => {
        const response = await apiFetch(
            `/api/v1/locations/${locationId}/spaces/${spaceId}/tasks/${taskId}`,
            { method: "DELETE" },
        );
        if (!response.ok) {
            throw new Error(await extractErrorMessage(response, "Error archiving space task"));
        }
    },

    previewBulkImport: async (csvContent: string): Promise<LocationBulkImportPreview> => {
        const response = await apiFetch("/api/v1/locations/import/preview", {
            method: "POST",
            body: JSON.stringify({ csv_content: csvContent }),
        });
        if (!response.ok) {
            throw new Error(await extractErrorMessage(response, "Error previewing location import"));
        }
        return await response.json();
    },

    importBulkLocations: async (csvContent: string): Promise<LocationBulkImportResult> => {
        const response = await apiFetch("/api/v1/locations/import", {
            method: "POST",
            body: JSON.stringify({ csv_content: csvContent }),
        });
        if (!response.ok) {
            throw new Error(await extractErrorMessage(response, "Error importing locations"));
        }
        return await response.json();
    },
};
