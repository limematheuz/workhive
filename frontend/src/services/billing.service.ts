import { apiFetch, assertApiResponseOk } from "@/lib/api";

export type PublicPlanCode = "basic" | "medium" | "top" | "mega";
export type BillingInterval = "monthly" | "annual";

export const PUBLIC_PLAN_CODES: PublicPlanCode[] = [
    "basic",
    "medium",
    "top",
    "mega",
];

export function isPublicPlanCode(value: string | null): value is PublicPlanCode {
    return value !== null && PUBLIC_PLAN_CODES.includes(value as PublicPlanCode);
}

export type PublicPlanEntitlement = {
    code: string;
    value_type: "boolean" | "integer";
    value: boolean | number;
};

export type PublicPlanPrice = {
    billing_interval: BillingInterval;
    amount_cents: number;
    currency: "EUR";
    tax_behavior: "exclusive" | "inclusive";
    checkout_available: boolean;
};

export type PublicPlan = {
    code: PublicPlanCode;
    version: number;
    entitlements: PublicPlanEntitlement[];
    prices: PublicPlanPrice[];
};

export type CompanyPurchaseCheckoutInput = {
    plan: PublicPlanCode;
    billing_interval: BillingInterval;
    company_name: string;
    tax_id: string;
    address: string;
    postal_code?: string;
    city?: string;
    province?: string;
    phone: string;
    company_email: string;
    owner_full_name: string;
    owner_email: string;
    accept_terms: boolean;
    accept_privacy: boolean;
    marketing_consent: boolean;
};

export const billingService = {
    listPublicPlans: async (): Promise<PublicPlan[]> => {
        const response = await apiFetch("/api/v1/billing/plans", {
            method: "GET",
            cache: "no-store",
        });
        await assertApiResponseOk(response, "No se pudieron cargar los planes disponibles.");
        return (await response.json()) as PublicPlan[];
    },

    createCheckout: async (
        plan: PublicPlanCode,
        billingInterval: BillingInterval,
    ): Promise<string> => {
        const response = await apiFetch("/api/v1/billing/checkout", {
            method: "POST",
            body: JSON.stringify({ plan, billing_interval: billingInterval }),
        });
        await assertApiResponseOk(response, "No se pudo iniciar el pago seguro.");
        const payload = (await response.json()) as { url: string };
        return payload.url;
    },

    createCompanyPurchaseCheckout: async (
        input: CompanyPurchaseCheckoutInput,
    ): Promise<string> => {
        const response = await apiFetch("/api/v1/billing/purchases/checkout", {
            method: "POST",
            body: JSON.stringify(input),
        });
        await assertApiResponseOk(response, "No se pudo iniciar el pago seguro.");
        const payload = (await response.json()) as { url: string };
        return payload.url;
    },

    activateCompanyPurchase: async (token: string, password: string): Promise<void> => {
        const response = await apiFetch("/api/v1/billing/purchases/activate", {
            method: "POST",
            body: JSON.stringify({ token, password }),
        });
        await assertApiResponseOk(response, "No se pudo activar la empresa.");
    },

    createPortal: async (): Promise<string> => {
        const response = await apiFetch("/api/v1/billing/portal", {
            method: "POST",
        });
        await assertApiResponseOk(response, "No se pudo abrir el portal de facturación.");
        const payload = (await response.json()) as { url: string };
        return payload.url;
    },
};
