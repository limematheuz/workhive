import assert from "node:assert/strict";
import test from "node:test";

import type { Invoice } from "@/types/invoice";
import {
    buildInvoiceSummaryRows,
    filterInvoiceSummaryRows,
    getInvoiceIssueYear,
    summarizeInvoiceSummaryRows,
} from "./invoice-summary.ts";

function makeInvoice(overrides: Partial<Invoice>): Invoice {
    return {
        id: 1,
        invoice_number: "FV/2026/0001",
        client_id: 1,
        company_id: 1,
        issue_date: "2026-01-05T12:00:00Z",
        due_date: "2026-01-20T12:00:00Z",
        status: "issued",
        base_amount: 100,
        tax_amount: 21,
        total_amount: 121,
        is_rectification: false,
        fiscal_submission_status: "not_configured",
        discount: 0,
        equivalence_surcharge: 0,
        retention: 0,
        items: [{
            id: 1,
            invoice_id: 1,
            description: "Limpieza de cambio",
            quantity: 1,
            unit_price: 100,
            tax_rate: 0.21,
            subtotal: 100,
            total: 121,
            created_at: "2026-01-05T12:00:00Z",
            updated_at: "2026-01-05T12:00:00Z",
        }],
        created_at: "2026-01-05T12:00:00Z",
        updated_at: "2026-01-05T12:00:00Z",
        ...overrides,
    };
}

test("invoice summary only shows fiscal invoices and excludes drafts", () => {
    const rows = buildInvoiceSummaryRows([
        makeInvoice({ id: 1, status: "draft" }),
        makeInvoice({ id: 2, status: "cancelled" }),
        makeInvoice({ id: 3, status: "issued" }),
        makeInvoice({ id: 4, status: "rectified", total_amount: 121 }),
        makeInvoice({ id: 5, status: "issued", is_rectification: true, total_amount: -121, base_amount: -100, tax_amount: -21 }),
    ], new Map([[1, "Cliente actual"]]));

    assert.deepEqual(rows.map((row) => row.invoice.id), [3, 4, 5]);
    assert.equal(summarizeInvoiceSummaryRows(rows).total, 121);
});

test("invoice summary reads frozen fiscal party and bank details", () => {
    const [row] = buildInvoiceSummaryRows([
        makeInvoice({
            recipient_snapshot: { name: "Cliente fiscal SL" },
            issuer_snapshot: { bank_account: "ES12 3456" },
            payment_method: "direct_debit",
        }),
    ], new Map([[1, "Cliente cambiado"]]));

    assert.equal(row.clientName, "Cliente fiscal SL");
    assert.equal(row.paymentAccount, "ES12 3456");
    assert.equal(row.paymentMethod, "direct_debit");
});

test("invoice summary filters by year and text without changing totals", () => {
    const rows = buildInvoiceSummaryRows([
        makeInvoice({ id: 1, invoice_number: "FV/2026/0001", recipient_snapshot: { name: "Bosch" } }),
        makeInvoice({ id: 2, invoice_number: "FV/2025/0001", issue_date: "2025-12-20T12:00:00Z", recipient_snapshot: { name: "Port Blanc" } }),
    ], new Map());

    assert.deepEqual(
        filterInvoiceSummaryRows(rows, { year: "2026", search: "bosch" }).map((row) => row.invoice.id),
        [1],
    );
});

test("invoice summary uses the stored calendar year without a timezone shift", () => {
    assert.equal(getInvoiceIssueYear("2026-01-01T00:00:00Z"), "2026");
    assert.equal(getInvoiceIssueYear("not-a-date"), "");
});

test("invoice summary separates collected from pending definitive invoices", () => {
    const rows = buildInvoiceSummaryRows([
        makeInvoice({ id: 1, status: "paid", total_amount: 121 }),
        makeInvoice({ id: 2, status: "overdue", total_amount: 242 }),
        makeInvoice({ id: 3, status: "issued", total_amount: 60.5 }),
    ], new Map());

    assert.deepEqual(summarizeInvoiceSummaryRows(rows), {
        base: 300,
        tax: 63,
        total: 423.5,
        paid: 121,
        pending: 302.5,
    });
});
