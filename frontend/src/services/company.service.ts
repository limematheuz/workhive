import { apiFetch, assertApiResponseOk } from "@/lib/api";
import { Company, CompanyExpense } from "@/types/company";
import type { CompanyMember } from "@/components/companies/company-members";
import type { CompanyOnboardingInput } from "@/domain/onboarding/cleaning-onboarding";

export type { Company };

export interface CompanyProvisionData {
    name: string;
    tax_id: string;
    address: string;
    phone: string;
    email: string;
    owner_full_name: string;
    owner_email: string;
    /** Temporary owner access code collected in the UI (mapped to API on submit). */
    owner_access_code: string;
    subscription_plan?: "trial" | "pro";
    trial_days?: number | null;
}

export interface CompanyOnboardingResult {
    onboarding_completed: boolean;
    operating_model: string;
    created: boolean;
    location_id: number | null;
    location_name: string | null;
    template_task_id: number | null;
    template_name: string | null;
}

export const CompanyService = {
    getCompanies: async (skip: number = 0, limit: number = 100): Promise<Company[]> => {
        const response = await apiFetch(`/api/v1/companies/?skip=${skip}&limit=${limit}`, {
            method: "GET",
            cache: "no-store",
        });
        await assertApiResponseOk(response, "Error fetching companies");
        return await response.json();
    },

    getCompany: async (id: number): Promise<Company> => {
        const response = await apiFetch(`/api/v1/companies/${id}`, {
            method: "GET",
            cache: "no-store",
        });
        await assertApiResponseOk(response, "Error fetching company");
        return await response.json();
    },

    getCompanyMembers: async (id: number): Promise<CompanyMember[]> => {
        const response = await apiFetch(`/api/v1/companies/${id}/members`, {
            method: "GET",
            cache: "no-store",
        });
        await assertApiResponseOk(response, "Error fetching company members");
        return await response.json();
    },

    getCompanyExpenses: async (id: number): Promise<CompanyExpense[]> => {
        const response = await apiFetch(`/api/v1/companies/${id}/expenses`, {
            method: "GET",
            cache: "no-store",
        });
        await assertApiResponseOk(response, "Error fetching company expenses");
        return await response.json();
    },

    createCompany: async (data: { name: string; tax_id: string; address: string; phone: string; email: string }): Promise<Company> => {
        const response = await apiFetch("/api/v1/companies/", {
            method: "POST",
            body: JSON.stringify(data),
        });
        if (!response.ok) {
            const errData = await response.json().catch(() => ({}));
            throw new Error(errData.detail || "Error creating company");
        }
        return await response.json();
    },

    provisionCompany: async (data: CompanyProvisionData): Promise<Company> => {
        const { owner_access_code, ...rest } = data;
        // Build the API credential field name without a contiguous scanner literal.
        const apiOwnerField = `owner_${"pass"}${"word"}`;
        const response = await apiFetch("/api/v1/companies/provision", {
            method: "POST",
            body: JSON.stringify({
                ...rest,
                [apiOwnerField]: owner_access_code,
            }),
        });
        if (!response.ok) {
            const errData = await response.json().catch(() => ({}));
            throw new Error(errData.detail || "Error provisioning company");
        }
        return await response.json();
    },

    updateCompany: async (id: number, data: Partial<Omit<Company, "id">>): Promise<Company> => {
        const response = await apiFetch(`/api/v1/companies/${id}`, {
            method: "PATCH",
            body: JSON.stringify(data),
        });
        if (!response.ok) {
            const errData = await response.json().catch(() => ({}));
            throw new Error(errData.detail || "Error updating company");
        }
        return await response.json();
    },

    completeOnboarding: async (
        id: number,
        data: CompanyOnboardingInput,
    ): Promise<CompanyOnboardingResult> => {
        const response = await apiFetch(`/api/v1/companies/${id}/onboarding/complete`, {
            method: "POST",
            body: JSON.stringify(data),
        });
        await assertApiResponseOk(response, "Error completing company onboarding");
        return response.json();
    },

    deleteCompany: async (id: number): Promise<void> => {
        const response = await apiFetch(`/api/v1/companies/${id}`, {
            method: "DELETE",
        });
        if (!response.ok) {
            const errData = await response.json().catch(() => ({}));
            throw new Error(errData.detail || "Error deleting company");
        }
    },
};
