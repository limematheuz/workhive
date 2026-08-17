import { apiFetch, extractErrorMessage } from "@/lib/api";

export interface CompanyFiscalSettings {
    enabled: boolean;
    global_enabled: boolean;
    company_enabled: boolean;
    environment: "test" | "production";
    quarterly_vat_enabled: boolean;
    quarterly_withholding_enabled: boolean;
    fiscal_reminder_days: number;
    certificate_configured: boolean;
    certificate_uploaded_at?: string | null;
    producer_configured: boolean;
    official_schemas_available: boolean;
    submission_available: boolean;
    endpoint: string;
    missing_fields: string[];
}

export interface CompanyFiscalSettingsUpdate {
    enabled?: boolean;
    environment?: "test" | "production";
    quarterly_vat_enabled?: boolean;
    quarterly_withholding_enabled?: boolean;
    fiscal_reminder_days?: number;
}

export const FiscalSettingsService = {
    getSettings: async (): Promise<CompanyFiscalSettings> => {
        const response = await apiFetch("/api/v1/fiscal-settings/", {
            method: "GET",
            cache: "no-store",
        });
        if (!response.ok) {
            throw new Error(await extractErrorMessage(response, "Error loading fiscal settings"));
        }
        return await response.json();
    },

    updateSettings: async (
        data: CompanyFiscalSettingsUpdate
    ): Promise<CompanyFiscalSettings> => {
        const response = await apiFetch("/api/v1/fiscal-settings/", {
            method: "PATCH",
            body: JSON.stringify(data),
        });
        if (!response.ok) {
            throw new Error(await extractErrorMessage(response, "Error updating fiscal settings"));
        }
        return await response.json();
    },

    uploadCertificate: async (
        file: File,
        password: string
    ): Promise<CompanyFiscalSettings> => {
        const formData = new FormData();
        formData.set("file", file);
        formData.set("password", password);
        const response = await apiFetch("/api/v1/fiscal-settings/certificate", {
            method: "POST",
            body: formData,
        });
        if (!response.ok) {
            throw new Error(await extractErrorMessage(response, "Error uploading fiscal certificate"));
        }
        return await response.json();
    },

    validateSettings: async (): Promise<CompanyFiscalSettings> => {
        const response = await apiFetch("/api/v1/fiscal-settings/validate", {
            method: "POST",
            body: JSON.stringify({}),
        });
        if (!response.ok) {
            throw new Error(await extractErrorMessage(response, "Error validating fiscal settings"));
        }
        return await response.json();
    },
};
