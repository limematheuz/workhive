import type {
    LocationMargin,
    MarginForecast,
    MarginForecastBudget,
    ServiceMargin,
} from "../types/margin-forecast.ts";

type ApiAmount = number | string;

export type ApiMarginForecast = Omit<
    MarginForecast,
    | "budget"
    | "planned_revenue_base_amount"
    | "planned_direct_cost_base_amount"
    | "planned_margin_base_amount"
    | "actual_revenue_base_amount"
    | "actual_labor_cost_base_amount"
    | "actual_material_cost_base_amount"
    | "actual_expense_cost_base_amount"
    | "actual_direct_cost_base_amount"
    | "actual_margin_base_amount"
    | "direct_cost_variance_base_amount"
> & {
    budget: Omit<MarginForecastBudget, "planned_direct_cost_amount"> & {
        planned_direct_cost_amount: ApiAmount;
    } | null;
    planned_revenue_base_amount: ApiAmount | null;
    planned_direct_cost_base_amount: ApiAmount | null;
    planned_margin_base_amount: ApiAmount | null;
    actual_revenue_base_amount: ApiAmount;
    actual_labor_cost_base_amount: ApiAmount;
    actual_material_cost_base_amount: ApiAmount;
    actual_expense_cost_base_amount: ApiAmount;
    actual_direct_cost_base_amount: ApiAmount;
    actual_margin_base_amount: ApiAmount;
    direct_cost_variance_base_amount: ApiAmount | null;
};

function amount(value: ApiAmount): number {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
}

function nullableAmount(value: ApiAmount | null): number | null {
    return value === null ? null : amount(value);
}

export function normalizeMarginForecast(data: ApiMarginForecast): MarginForecast {
    return {
        ...data,
        budget: data.budget ? {
            ...data.budget,
            planned_direct_cost_amount: amount(data.budget.planned_direct_cost_amount),
        } : null,
        planned_revenue_base_amount: nullableAmount(data.planned_revenue_base_amount),
        planned_direct_cost_base_amount: nullableAmount(data.planned_direct_cost_base_amount),
        planned_margin_base_amount: nullableAmount(data.planned_margin_base_amount),
        actual_revenue_base_amount: amount(data.actual_revenue_base_amount),
        actual_labor_cost_base_amount: amount(data.actual_labor_cost_base_amount),
        actual_material_cost_base_amount: amount(data.actual_material_cost_base_amount),
        actual_expense_cost_base_amount: amount(data.actual_expense_cost_base_amount),
        actual_direct_cost_base_amount: amount(data.actual_direct_cost_base_amount),
        actual_margin_base_amount: amount(data.actual_margin_base_amount),
        direct_cost_variance_base_amount: nullableAmount(data.direct_cost_variance_base_amount),
    };
}

export type ApiLocationMargin = Omit<
    LocationMargin,
    | "actual_revenue_base_amount"
    | "actual_labor_cost_base_amount"
    | "actual_material_cost_base_amount"
    | "actual_expense_cost_base_amount"
    | "actual_direct_cost_base_amount"
    | "actual_margin_base_amount"
> & {
    actual_revenue_base_amount: ApiAmount;
    actual_labor_cost_base_amount: ApiAmount;
    actual_material_cost_base_amount: ApiAmount;
    actual_expense_cost_base_amount: ApiAmount;
    actual_direct_cost_base_amount: ApiAmount;
    actual_margin_base_amount: ApiAmount;
};

export function normalizeLocationMargin(data: ApiLocationMargin): LocationMargin {
    return {
        ...data,
        actual_revenue_base_amount: amount(data.actual_revenue_base_amount),
        actual_labor_cost_base_amount: amount(data.actual_labor_cost_base_amount),
        actual_material_cost_base_amount: amount(data.actual_material_cost_base_amount),
        actual_expense_cost_base_amount: amount(data.actual_expense_cost_base_amount),
        actual_direct_cost_base_amount: amount(data.actual_direct_cost_base_amount),
        actual_margin_base_amount: amount(data.actual_margin_base_amount),
    };
}

export type ApiServiceMargin = Omit<
    ServiceMargin,
    | "actual_revenue_base_amount"
    | "actual_labor_cost_base_amount"
    | "known_direct_cost_base_amount"
    | "known_margin_base_amount"
> & {
    actual_revenue_base_amount: ApiAmount;
    actual_labor_cost_base_amount: ApiAmount;
    known_direct_cost_base_amount: ApiAmount;
    known_margin_base_amount: ApiAmount;
};

export function normalizeServiceMargin(data: ApiServiceMargin): ServiceMargin {
    return {
        ...data,
        actual_revenue_base_amount: amount(data.actual_revenue_base_amount),
        actual_labor_cost_base_amount: amount(data.actual_labor_cost_base_amount),
        known_direct_cost_base_amount: amount(data.known_direct_cost_base_amount),
        known_margin_base_amount: amount(data.known_margin_base_amount),
    };
}
