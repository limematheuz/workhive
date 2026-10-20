import assert from "node:assert/strict";
import test from "node:test";

import { computeInvoiceStats, countOpenInvoices } from "../components/invoices/invoice-stats.ts";
import type { Invoice } from "../types/invoice.ts";

const invoice = (status: Invoice["status"], total_amount: number, is_rectification = false, collected_amount = 0) => ({ status, total_amount, is_rectification, collected_amount }) as Invoice;

test("invoice summary excludes drafts and cancellations from billed and collectible amounts", () => {
    const invoices = [invoice("draft", 12), invoice("cancelled", 9), invoice("issued", 5)];
    assert.deepEqual(computeInvoiceStats(invoices), {
        totalCount: 1,
        totalAmount: 5,
        paidAmount: 0,
        openCount: 1,
        openAmount: 5,
        overdueAmount: 0,
    });
    assert.equal(countOpenInvoices(invoices), 1);
});

test("invoice summary retains issued, paid, overdue, and rectifying invoice values", () => {
    const invoices = [
        invoice("issued", 10),
        invoice("partially_paid", 8, false, 3),
        invoice("paid", 7, false, 7),
        invoice("overdue", 6),
        invoice("rectified", 5),
        invoice("issued", -5, true),
    ];
    assert.deepEqual(computeInvoiceStats(invoices), {
        totalCount: 6,
        totalAmount: 31,
        paidAmount: 10,
        openCount: 3,
        openAmount: 21,
        overdueAmount: 6,
    });
    assert.equal(countOpenInvoices(invoices), 3);
});

test("partial collection changes collected and outstanding cards by the allocated amount", () => {
    assert.deepEqual(computeInvoiceStats([invoice("partially_paid", 1.21, false, 0.5)]), {
        totalCount: 1,
        totalAmount: 1.21,
        paidAmount: 0.5,
        openCount: 1,
        openAmount: 0.71,
        overdueAmount: 0,
    });
    assert.equal(computeInvoiceStats([invoice("overdue", 1.21, false, 0.5)]).overdueAmount, 0.71);
});
