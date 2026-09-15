export type MarginForecastScopeType = "contract" | "work_order";

export interface MarginForecastBudget {
    id: number;
    planned_direct_cost_amount: number;
    notes: string | null;
    created_at: string;
    updated_at: string;
}

export interface MarginForecast {
    scope_type: MarginForecastScopeType;
    scope_id: number;
    scope_name: string;
    budget: MarginForecastBudget | null;
    planned_revenue_base_amount: number | null;
    planned_direct_cost_base_amount: number | null;
    planned_margin_base_amount: number | null;
    actual_revenue_base_amount: number;
    actual_labor_cost_base_amount: number;
    actual_material_cost_base_amount: number;
    actual_expense_cost_base_amount: number;
    actual_direct_cost_base_amount: number;
    actual_margin_base_amount: number;
    direct_cost_variance_base_amount: number | null;
}

export interface MarginForecastPayload {
    planned_direct_cost_amount: number;
    notes?: string | null;
}

export interface LocationMargin {
    scope_type: "location";
    scope_id: number;
    scope_name: string;
    actual_revenue_base_amount: number;
    actual_labor_cost_base_amount: number;
    actual_material_cost_base_amount: number;
    actual_expense_cost_base_amount: number;
    actual_direct_cost_base_amount: number;
    actual_margin_base_amount: number;
}

export interface ServiceMarginScope {
    id: number;
    name: string;
    version: number;
}

export interface ServiceMargin {
    scope_type: "service";
    scope_id: number;
    scope_name: string;
    actual_revenue_base_amount: number;
    actual_labor_cost_base_amount: number;
    known_direct_cost_base_amount: number;
    known_margin_base_amount: number;
}

export interface TeamLaborCost {
    team_id: number;
    team_name: string;
    work_session_count: number;
    actual_labor_cost_base_amount: number;
}
