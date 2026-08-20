import assert from "node:assert/strict";
import test from "node:test";

import { normalizeClientProfitabilityPeriod } from "./client-profitability.service.ts";

test("client profitability normalizes decimal API values without leaking NaN", () => {
    const result = normalizeClientProfitabilityPeriod({
        revenue_base_amount: "250.50",
        direct_cost_base_amount: "not-a-number",
        known_margin_amount: "250.50",
        known_margin_percentage: "100.00",
        client_count: 1,
        unassigned_expense_base_amount: "20.00",
        unlinked_historical_sales_base_amount: "",
        clients: [{
            client_id: 9,
            client_name: "Cliente de prueba",
            invoice_count: 2,
            direct_cost_count: 1,
            revenue_base_amount: "250.50",
            direct_cost_base_amount: "20.00",
            known_margin_amount: "230.50",
            known_margin_percentage: null,
        }],
    });

    assert.equal(result.revenue_base_amount, 250.5);
    assert.equal(result.direct_cost_base_amount, 0);
    assert.equal(result.unlinked_historical_sales_base_amount, 0);
    assert.equal(result.clients[0].known_margin_amount, 230.5);
    assert.equal(result.clients[0].known_margin_percentage, null);
});
