import assert from "node:assert/strict";
import test from "node:test";

import {
    getFiscalPeriodActivityLabel,
    getFiscalSummaryYearOptions,
    getFiscalVatBalanceState,
} from "./fiscal-summary.ts";

test("fiscal VAT balance identifies payable, credit, and balanced periods", () => {
    assert.equal(getFiscalVatBalanceState(12.5), "payable");
    assert.equal(getFiscalVatBalanceState(-0.01), "credit");
    assert.equal(getFiscalVatBalanceState(0), "balanced");
});

test("fiscal year options keep the selected period and avoid duplicate years", () => {
    assert.deepEqual(getFiscalSummaryYearOptions(2024, 2026), [2026, 2025, 2024]);
    assert.deepEqual(getFiscalSummaryYearOptions(2026, 2026), [2026, 2025, 2024]);
});

test("fiscal period activity label remains compact for the data table", () => {
    assert.equal(getFiscalPeriodActivityLabel({
        key: "Q1",
        label: "T1",
        issued_invoice_count: 3,
        registered_expense_count: 2,
        output_base_amount: 0,
        output_vat_amount: 0,
        equivalence_surcharge_amount: 0,
        registered_expense_base_amount: 0,
        registered_input_vat_amount: 0,
        estimated_vat_balance: 0,
        withheld_irpf_amount: 0,
    }), "3/2");
});
