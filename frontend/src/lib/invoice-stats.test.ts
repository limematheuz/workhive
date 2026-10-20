import assert from "node:assert/strict";
import test from "node:test";

import { computeInvoiceStats, countOpenInvoices } from "../components/invoices/invoice-stats.ts";
import type { Invoice } from "../types/invoice.ts";

const invoice = (status: Invoice["status"], total_amount: number, is_rectification = false) => ({ status, total_amount, is_rectification }) as Invoice;

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
        invoice("partially_paid", 8),
        invoice("paid", 7),
        invoice("overdue", 6),
        invoice("rectified", 5),
        invoice("issued", -5, true),
    ];
    assert.deepEqual(computeInvoiceStats(invoices), {
        totalCount: 6,
        totalAmount: 31,
        paidAmount: 7,
        openCount: 3,
        openAmount: 24,
        overdueAmount: 6,
    });
    assert.equal(countOpenInvoices(invoices), 3);
});
