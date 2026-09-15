import assert from "node:assert/strict";
import test from "node:test";

import { normalizeMarginForecast } from "./margin-forecast.ts";

test("margin forecast normalizes decimal API values and preserves missing projections", () => {
    const result = normalizeMarginForecast({
        scope_type: "work_order",
        scope_id: 42,
        scope_name: "Orden de prueba",
        budget: null,
        planned_revenue_base_amount: null,
        planned_direct_cost_base_amount: null,
        planned_margin_base_amount: null,
        actual_revenue_base_amount: "125.00",
        actual_labor_cost_base_amount: "20.00",
        actual_material_cost_base_amount: "5.50",
        actual_expense_cost_base_amount: "10.00",
        actual_direct_cost_base_amount: "25.50",
        actual_margin_base_amount: "99.50",
        direct_cost_variance_base_amount: null,
    });

    assert.equal(result.actual_margin_base_amount, 99.5);
    assert.equal(result.actual_direct_cost_base_amount, 25.5);
    assert.equal(result.planned_margin_base_amount, null);
});
