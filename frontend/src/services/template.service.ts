import { apiFetch, assertApiResponseOk, extractErrorMessage } from "@/lib/api";
import type {
    LocationTemplate,
    TemplateTask,
    ServiceCatalogVersion,
} from "@/types/template";

export interface TemplateTaskInput {
    name: string;
    description?: string | null;
    default_price?: number | null;
    unit: string;
    pricing_mode?: "fixed" | "hourly";
    estimated_duration_minutes?: number | null;
    requirements?: string | null;
    is_active?: boolean;
}

export interface LocationTemplateOverrides {
    custom_price: number | null;
    custom_name?: string | null;
    custom_description?: string | null;
    custom_unit?: string | null;
}

export const TemplateTaskService = {
    getTemplates: async (): Promise<TemplateTask[]> => {
        const response = await apiFetch("/api/v1/template-tasks/", {
            method: "GET",
            cache: "no-store",
        });
        if (!response.ok) {
            throw new Error(await extractErrorMessage(response, "Error loading templates"));
        }
        return response.json();
    },

    createTemplate: async (input: TemplateTaskInput): Promise<TemplateTask> => {
        const response = await apiFetch("/api/v1/template-tasks/", {
            method: "POST",
            body: JSON.stringify(input),
        });
        await assertApiResponseOk(response, "Error creating template");
        return response.json();
    },

    updateTemplate: async (
        templateId: number,
        input: Partial<TemplateTaskInput>
    ): Promise<TemplateTask> => {
        const response = await apiFetch(`/api/v1/template-tasks/${templateId}`, {
            method: "PATCH",
            body: JSON.stringify(input),
        });
        await assertApiResponseOk(response, "Error updating template");
        return response.json();
    },

    deleteTemplate: async (templateId: number): Promise<void> => {
        const response = await apiFetch(`/api/v1/template-tasks/${templateId}`, {
            method: "DELETE",
        });
        if (!response.ok) {
            throw new Error(await extractErrorMessage(response, "Error deleting template"));
        }
    },

    getVersions: async (templateId: number): Promise<ServiceCatalogVersion[]> => {
        const response = await apiFetch(`/api/v1/template-tasks/${templateId}/versions`, {
            method: "GET",
            cache: "no-store",
        });
        if (!response.ok) {
            throw new Error(await extractErrorMessage(response, "Error loading service versions"));
        }
        return response.json();
    },
};

export const LocationTemplateService = {
    getTemplates: async (locationId: number): Promise<LocationTemplate[]> => {
        const response = await apiFetch(`/api/v1/locations/${locationId}/templates`, {
            method: "GET",
            cache: "no-store",
        });
        if (!response.ok) {
            throw new Error(
                await extractErrorMessage(response, "Error loading location templates")
            );
        }
        return response.json();
    },

    assignTemplate: async (
        locationId: number,
        templateTaskId: number,
        customPrice: number | null
    ): Promise<LocationTemplate> => {
        const response = await apiFetch(`/api/v1/locations/${locationId}/templates`, {
            method: "POST",
            body: JSON.stringify({
                template_task_id: templateTaskId,
                custom_price: customPrice,
            }),
        });
        if (!response.ok) {
            throw new Error(
                await extractErrorMessage(response, "Error assigning location template")
            );
        }
        return response.json();
    },

    updatePrice: async (
        locationId: number,
        templateTaskId: number,
        customPrice: number | null
    ): Promise<LocationTemplate> => {
        const response = await apiFetch(
            `/api/v1/locations/${locationId}/templates/${templateTaskId}`,
            {
                method: "PATCH",
                body: JSON.stringify({ custom_price: customPrice }),
            }
        );
        if (!response.ok) {
            throw new Error(
                await extractErrorMessage(response, "Error updating template price")
            );
        }
        return response.json();
    },

    updateOverrides: async (
        locationId: number,
        templateTaskId: number,
        overrides: LocationTemplateOverrides,
    ): Promise<LocationTemplate> => {
        const response = await apiFetch(
            `/api/v1/locations/${locationId}/templates/${templateTaskId}`,
            {
                method: "PATCH",
                body: JSON.stringify(overrides),
            },
        );
        if (!response.ok) {
            throw new Error(
                await extractErrorMessage(response, "Error updating fixed task"),
            );
        }
        return response.json();
    },

    removeTemplate: async (
        locationId: number,
        templateTaskId: number
    ): Promise<void> => {
        const response = await apiFetch(
            `/api/v1/locations/${locationId}/templates/${templateTaskId}`,
            { method: "DELETE" }
        );
        if (!response.ok) {
            throw new Error(
                await extractErrorMessage(response, "Error removing location template")
            );
        }
    },
};
