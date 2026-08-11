import {
    hasValidTaskPricingAgreement,
    pricingValuesForTaskEdit,
    type TaskPricingEditValues,
    type TaskPricingMode,
    type TaskPricingState,
} from "../../lib/task-pricing.ts";

export type TaskAcceptanceInput = {
    scheduledStartAt?: string;
    pricing: TaskPricingEditValues;
};

function optionalNumber(value: string): number | null {
    if (!value.trim()) return null;
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : null;
}

export function hasValidTaskAcceptancePricing(
    pricing: TaskPricingEditValues,
): boolean {
    return hasValidTaskPricingAgreement(
        pricing.pricingMode,
        optionalNumber(pricing.price),
    );
}

export function acceptancePricingValuesForTask(
    task: TaskPricingState,
): TaskPricingEditValues {
    const values = pricingValuesForTaskEdit(task);
    return {
        ...values,
        quantity: values.quantity || "1",
    };
}

export function buildTaskAcceptancePayload(input: TaskAcceptanceInput): {
    scheduled_start_at: string | null;
    pricing_mode: TaskPricingMode;
    price: number | null;
    quantity: number | null;
    unit: string;
} {
    const { pricing } = input;
    return {
        scheduled_start_at: input.scheduledStartAt || null,
        pricing_mode: pricing.pricingMode,
        price: optionalNumber(pricing.price),
        quantity: optionalNumber(pricing.quantity),
        unit: pricing.pricingMode === "hourly" ? "hour" : pricing.unit,
    };
}
