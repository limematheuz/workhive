import type { Entitlement, EntitlementValue } from "@/services/company-plan-access.service";
import type { CommercialTermsPayload } from "@/lib/commercial-terms";

export type CommercialChange = {
    label: string;
    previous: string;
    next: string;
    isReduction?: boolean;
};

function formatEntitlementValue(value: EntitlementValue): string {
    return typeof value === "boolean" ? (value ? "Incluida" : "No incluida") : String(value);
}

export function entitlementChanges(
    entitlements: Entitlement[],
    previousValues: Record<string, EntitlementValue>,
    nextValues: Record<string, EntitlementValue>,
): CommercialChange[] {
    return entitlements.flatMap((entitlement) => {
        const previous = previousValues[entitlement.code];
        const next = nextValues[entitlement.code];
        if (previous === next) return [];
        return [{
            label: entitlement.label,
            previous: formatEntitlementValue(previous),
            next: formatEntitlementValue(next),
            isReduction: entitlement.value_type === "boolean"
                ? previous === true && next === false
                : Number(next) < Number(previous),
        }];
    });
}

function formatCommercialTerms(terms: CommercialTermsPayload): string {
    return `${terms.amount_cents / 100} ${terms.currency} · ${terms.billing_interval === "annual" ? "anual" : "mensual"}`;
}

export function commercialTermsChanges(
    previousTerms: CommercialTermsPayload | null,
    nextTerms: CommercialTermsPayload | null,
): CommercialChange[] {
    if (!nextTerms) {
        return [{
            label: "Condiciones comerciales",
            previous: previousTerms ? "Registradas" : "Sin registrar",
            next: "Pendiente de completar",
        }];
    }
    if (!previousTerms) {
        return [{
            label: "Condiciones comerciales",
            previous: "Sin registrar",
            next: formatCommercialTerms(nextTerms),
        }];
    }
    if (
        nextTerms.billing_interval !== previousTerms.billing_interval
        || nextTerms.amount_cents !== previousTerms.amount_cents
        || nextTerms.currency !== previousTerms.currency
        || nextTerms.tax_behavior !== previousTerms.tax_behavior
        || nextTerms.effective_at !== previousTerms.effective_at
    ) {
        return [{
            label: "Condiciones comerciales",
            previous: formatCommercialTerms(previousTerms),
            next: formatCommercialTerms(nextTerms),
        }];
    }
    return [];
}
