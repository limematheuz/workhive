import type { Entitlement, EntitlementValue } from "@/services/company-plan-access.service";

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
