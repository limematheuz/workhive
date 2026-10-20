import assert from "node:assert/strict";
import test from "node:test";

import { canOfferCustomerPayment } from "../components/invoices/invoice-payment-eligibility.ts";

test("customer payment action matches the backend's payable invoice states", () => {
    for (const status of ["issued", "overdue", "partially_paid"] as const) {
        assert.equal(canOfferCustomerPayment({ status, is_rectification: false }, true, 1), true);
    }
    for (const status of ["draft", "paid", "cancelled", "rectified"] as const) {
        assert.equal(canOfferCustomerPayment({ status, is_rectification: false }, true, 1), false);
    }
});

test("customer payment action also requires permission, balance, and a normal invoice", () => {
    const invoice = { status: "issued" as const, is_rectification: false };
    assert.equal(canOfferCustomerPayment(invoice, false, 1), false);
    assert.equal(canOfferCustomerPayment(invoice, true, 0), false);
    assert.equal(canOfferCustomerPayment({ ...invoice, is_rectification: true }, true, 1), false);
});
