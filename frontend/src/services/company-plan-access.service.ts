import { apiFetch, extractErrorMessage } from "@/lib/api";

export type PlanCode = "basic" | "medium" | "top" | "mega" | "custom";
export type PlanStatus = "trialing" | "active";
export type EntitlementValue = boolean | number;

export type Entitlement = {
    code: string;
    label: string;
    group: "Funciones" | "Capacidad";
    value_type: "boolean" | "integer";
    value: EntitlementValue;
    source: "plan" | "exception";
    availability: "available" | "platform_internal" | "coming_soon";
};

export type PlanCatalogueItem = {
    code: PlanCode;
    label: string;
    version: number;
    entitlements: Entitlement[];
};

export type CompanyPlanAccess = {
    company_id: number;
    subscription: {
        plan_code: PlanCode;
        plan_label: string;
        plan_version: number | null;
        status: string;
        trial_ends_at: string | null;
        commercial_terms: CommercialTerms | null;
    };
    entitlements: Entitlement[];
    base_entitlements: Entitlement[];
    overrides: Array<{
        id: number;
        code: string;
        label: string;
        group: "Funciones" | "Capacidad";
        value_type: "boolean" | "integer";
        value: EntitlementValue;
        reason: string;
        starts_at: string;
        ends_at: string | null;
    }>;
    audit: Array<{
        id: number;
        action: string;
        reason: string | null;
        created_at: string;
    }>;
    usage: {
        administrators: number;
        managers: number;
        workers: number;
        departments: number;
        teams: number;
    };
};

export type CurrentCompanyEntitlements = {
    entitlements: Entitlement[];
};

export type CommercialPlanOverview = {
    code: PlanCode;
    label: string;
    active_subscriptions: number;
    trial_subscriptions: number;
    payment_attention_subscriptions: number;
    inactive_subscriptions: number;
    contracted_mrr_cents: number;
    subscriptions_without_commercial_terms: number;
};

export type CommercialOverview = {
    active_subscriptions: number;
    trial_subscriptions: number;
    payment_attention_subscriptions: number;
    upgrades_last_30_days: number;
    downgrades_last_30_days: number;
    churned_last_30_days: number;
    revenue_measurement_available: boolean;
    contracted_mrr_cents: number;
    active_subscriptions_without_commercial_terms: number;
    plans: CommercialPlanOverview[];
};

export type CommercialTerms = {
    billing_interval: "monthly" | "annual";
    amount_cents: number;
    currency: string;
    tax_behavior: "exclusive" | "inclusive";
    effective_at: string;
};

export type CompanyPlanAccessUpdate = {
    plan_code: PlanCode;
    status: PlanStatus;
    trial_ends_at?: string | null;
    commercial_terms?: CommercialTerms;
    reason: string;
};

export type CompanyEntitlementOverrideInput = {
    code: string;
    boolean_value?: boolean;
    integer_value?: number;
    ends_at?: string | null;
    reason: string;
};

export type EntitlementValueInput = {
    code: string;
    boolean_value?: boolean;
    integer_value?: number;
};

export type CompanyEntitlementCustomizationInput = {
    entitlements: EntitlementValueInput[];
    reason: string;
    ends_at?: string | null;
};

export type PlanCatalogUpdateInput = {
    entitlements: EntitlementValueInput[];
    reason: string;
};

export const CompanyPlanAccessService = {
    getCommercialOverview: async (): Promise<CommercialOverview> => {
        const response = await apiFetch("/api/v1/companies/commercial-overview", {
            method: "GET",
            cache: "no-store",
        });
        if (!response.ok) {
            throw new Error(await extractErrorMessage(response, "No se ha podido cargar el resumen comercial"));
        }
        return response.json();
    },

    getCurrentEntitlements: async (): Promise<CurrentCompanyEntitlements> => {
        const response = await apiFetch("/api/v1/companies/current/entitlements", {
            method: "GET",
            cache: "no-store",
        });
        if (!response.ok) {
            throw new Error(await extractErrorMessage(response, "No se han podido cargar las funciones del plan"));
        }
        return response.json();
    },

    getCatalogue: async (): Promise<PlanCatalogueItem[]> => {
        const response = await apiFetch("/api/v1/companies/plans/catalog", {
            method: "GET",
            cache: "no-store",
        });
        if (!response.ok) {
            throw new Error(await extractErrorMessage(response, "No se han podido cargar los planes"));
        }
        return response.json();
    },

    get: async (companyId: number): Promise<CompanyPlanAccess> => {
        const response = await apiFetch(`/api/v1/companies/${companyId}/plan-access`, {
            method: "GET",
            cache: "no-store",
        });
        if (!response.ok) {
            throw new Error(await extractErrorMessage(response, "No se ha podido cargar el plan y acceso"));
        }
        return response.json();
    },

    update: async (
        companyId: number,
        data: CompanyPlanAccessUpdate,
    ): Promise<CompanyPlanAccess> => {
        const response = await apiFetch(`/api/v1/companies/${companyId}/plan-access`, {
            method: "PUT",
            body: JSON.stringify(data),
        });
        if (!response.ok) {
            throw new Error(await extractErrorMessage(response, "No se ha podido actualizar el plan"));
        }
        return response.json();
    },

    updatePlanCatalog: async (
        planCode: Exclude<PlanCode, "custom">,
        data: PlanCatalogUpdateInput,
    ): Promise<PlanCatalogueItem> => {
        const response = await apiFetch(`/api/v1/companies/plans/${planCode}`, {
            method: "PUT",
            body: JSON.stringify(data),
        });
        if (!response.ok) {
            throw new Error(await extractErrorMessage(response, "No se ha podido publicar la nueva versión del plan"));
        }
        return response.json();
    },

    createOverride: async (
        companyId: number,
        data: CompanyEntitlementOverrideInput,
    ): Promise<CompanyPlanAccess["overrides"][number]> => {
        const response = await apiFetch(`/api/v1/companies/${companyId}/plan-access/overrides`, {
            method: "POST",
            body: JSON.stringify(data),
        });
        if (!response.ok) {
            throw new Error(await extractErrorMessage(response, "No se ha podido guardar el acceso personalizado"));
        }
        return response.json();
    },

    replaceCustomization: async (
        companyId: number,
        data: CompanyEntitlementCustomizationInput,
    ): Promise<CompanyPlanAccess> => {
        const response = await apiFetch(`/api/v1/companies/${companyId}/plan-access/customization`, {
            method: "PUT",
            body: JSON.stringify(data),
        });
        if (!response.ok) {
            throw new Error(await extractErrorMessage(response, "No se ha podido guardar la configuración personalizada"));
        }
        return response.json();
    },
};
