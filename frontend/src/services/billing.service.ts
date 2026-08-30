import { apiFetch, extractErrorMessage } from "@/lib/api";

// Legacy checkout values stay here only while the public pricing screen is
// migrated. New callers must use the canonical commercial plans.
export type BillingPlan =
    | "basic"
    | "medium"
    | "top"
    | "mega"
    | "business"
    | "pro"
    | "lifetime";

export const billingService = {
    createCheckout: async (plan: BillingPlan): Promise<string> => {
        const response = await apiFetch("/api/v1/billing/checkout", {
            method: "POST",
            body: JSON.stringify({ plan }),
        });
        if (!response.ok) {
            throw new Error(
                await extractErrorMessage(
                    response,
                    "No se pudo iniciar el pago seguro"
                )
            );
        }
        const payload = (await response.json()) as { url: string };
        return payload.url;
    },

    createPortal: async (): Promise<string> => {
        const response = await apiFetch("/api/v1/billing/portal", {
            method: "POST",
        });
        if (!response.ok) {
            throw new Error(
                await extractErrorMessage(
                    response,
                    "No se pudo abrir el portal de facturación"
                )
            );
        }
        const payload = (await response.json()) as { url: string };
        return payload.url;
    },
};
