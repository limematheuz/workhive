import assert from "node:assert/strict";
import test from "node:test";

import { calculatePerLineTaxTotals } from "./billing-calculations.ts";

function assertMoney(actual: number, expected: number) {
    assert.ok(Math.abs(actual - expected) < 0.000001);
}

test("three completed jobs calculate subtotal VAT and total correctly", () => {
    const totals = calculatePerLineTaxTotals(
        [
            { quantity: 1, unitPrice: 165, taxRate: 0.21 },
            { quantity: 1, unitPrice: 165, taxRate: 0.21 },
            { quantity: 1, unitPrice: 165, taxRate: 0.21 },
        ],
    );

    assert.equal(totals.subtotal, 495);
    assert.equal(totals.baseAmount, 495);
    assertMoney(totals.taxAmount, 103.95);
    assertMoney(totals.totalAmount, 598.95);
});

test("manual lines, discounts, surcharge and retention share the same totals", () => {
    const totals = calculatePerLineTaxTotals(
        [
            { quantity: 2, unitPrice: 50, taxRate: 0.21 },
            { quantity: 1, unitPrice: 25, taxRate: 0.1 },
        ],
        10,
        5.2,
        2,
    );

    assert.equal(totals.subtotal, 125);
    assert.equal(totals.discountAmount, 12.5);
    assert.equal(totals.baseAmount, 112.5);
    assertMoney(totals.taxAmount, 21.15);
    assertMoney(totals.surchargeAmount, 5.85);
    assertMoney(totals.retentionAmount, 2.25);
    assertMoney(totals.totalAmount, 137.25);
});
