import test from "node:test";
import assert from "node:assert/strict";
import { invoiceOutstandingCents, isInvoiceOverdue } from "./finance-priorities.ts";

const invoice = { total_amount: 121, collected_amount: 21, status: "partially_paid", due_date: "2026-11-16T00:00:00Z", is_rectification: false };
test("financial priorities show the remaining balance and exclude settled or credit documents", () => {
    assert.equal(invoiceOutstandingCents(invoice), 10000);
    assert.equal(isInvoiceOverdue(invoice, "2026-11-17"), true);
    for (const status of ["draft", "cancelled", "paid", "rectified"]) assert.equal(invoiceOutstandingCents({ ...invoice, status }), 0);
    assert.equal(invoiceOutstandingCents({ ...invoice, is_rectification: true }), 0);
    assert.equal(invoiceOutstandingCents({ ...invoice, collected_amount: 121 }), 0);
    assert.equal(invoiceOutstandingCents({ ...invoice, collected_amount: 200 }), 0);
});
test("due today remains current and an explicit overdue status stays actionable", () => {
    assert.equal(isInvoiceOverdue(invoice, "2026-11-16"), false);
    assert.equal(isInvoiceOverdue({ ...invoice, due_date: null }, "2026-11-17"), false);
    assert.equal(isInvoiceOverdue({ ...invoice, status: "overdue", due_date: null }, "2026-11-17"), true);
    assert.equal(invoiceOutstandingCents({ ...invoice, total_amount: 0.3, collected_amount: 0.1 }), 20);
});
