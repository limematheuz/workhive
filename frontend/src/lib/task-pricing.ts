export type TaskPricingMode = "fixed" | "hourly";

export type TaskPricingState = {
    price?: number | null;
    quantity?: number | null;
    unit?: string | null;
    pricing_mode?: TaskPricingMode | null;
    pricing_locked_at?: string | null;
    billing_pricing_mode_snapshot?: TaskPricingMode | null;
    billing_price_snapshot?: number | null;
    billing_quantity_snapshot?: number | null;
    billing_unit_snapshot?: string | null;
};

export type TaskPricingEditValues = {
    price: string;
    quantity: string;
    unit: string;
    pricingMode: TaskPricingMode;
};

export type TaskCreationPricingOverride = {
    pricingMode: TaskPricingMode;
    price: string;
};

type TaskCreationPricingDefaults = {
    pricingMode: TaskPricingMode;
    price: number | null;
    unit: string;
};

export function pricingValuesForTaskCreation(
    defaults: TaskCreationPricingDefaults,
): TaskCreationPricingOverride {
    return {
        pricingMode: defaults.pricingMode,
        price: defaults.price?.toString() || "",
    };
}

export function resolveTaskCreationPricing(
    defaults: TaskCreationPricingDefaults,
    override?: TaskCreationPricingOverride,
): {
    pricingMode: TaskPricingMode;
    price: number | null;
    unit: string;
} {
    const pricingMode = override?.pricingMode || defaults.pricingMode;
    return {
        pricingMode,
        price: optionalNumber(override?.price ?? defaults.price?.toString() ?? ""),
        unit: pricingMode === "hourly" ? "hour" : defaults.unit,
    };
}

export function hasValidTaskPricingAgreement(
    pricingMode: TaskPricingMode,
    price: number | null,
): boolean {
    if (price === null || !Number.isFinite(price)) return false;
    return pricingMode === "fixed" ? price >= 0 : price > 0;
}

function optionalNumber(value: string): number | null {
    if (!value.trim()) return null;
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : null;
}

export function pricingValuesForTaskEdit(
    task: TaskPricingState,
): TaskPricingEditValues {
    const pricingLocked = Boolean(task.pricing_locked_at);
    return {
        price: (pricingLocked ? task.billing_price_snapshot : task.price)?.toString() || "",
        quantity: (pricingLocked ? task.billing_quantity_snapshot : task.quantity)?.toString() || "",
        unit: (pricingLocked ? task.billing_unit_snapshot : task.unit) || "unidad",
        pricingMode: (pricingLocked
            ? task.billing_pricing_mode_snapshot
            : task.pricing_mode) === "hourly" ? "hourly" : "fixed",
    };
}

export function editableTaskPricingUpdate(
    task: TaskPricingState,
    values: TaskPricingEditValues,
): {
    price?: number | null;
    quantity?: number | null;
    unit?: string;
    pricing_mode?: TaskPricingMode;
} {
    if (task.pricing_locked_at) return {};

    return {
        price: optionalNumber(values.price),
        quantity: optionalNumber(values.quantity),
        unit: values.pricingMode === "hourly" ? "hour" : values.unit,
        pricing_mode: values.pricingMode,
    };
}
