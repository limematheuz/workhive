import assert from "node:assert/strict";
import test from "node:test";
import { comparableMonthDay, financeCents, financeChange, invoiceAgingBucket, paymentTotalCents, selectInvoiceAttention, selectPeriodPayments, throughComparableDay } from "./finance-workspace.ts";
import { isInvoiceOverdue } from "./finance-priorities.ts";
import { invoiceViewFilters } from "./invoice-view-state.ts";
import { filterWorkspaceQuotes } from "./quote-workspace.ts";
import { fiscalSourceRecords } from "./fiscal-source-records.ts";

const invoice = { id: 1, client_id: 2, invoice_number: "F-001", issue_date: "2025-12-01", due_date: "2026-01-31", status: "partially_paid", total_amount: 121, collected_amount: 21, is_rectification: false };
test("overdue is a positive balance before the balance day, regardless of a stale status", () => {
    const rows = [invoice, { ...invoice, id: 2, status: "overdue", due_date: "2026-12-01" }, { ...invoice, id: 3, status: "overdue", due_date: null }, { ...invoice, id: 4, collected_amount: 121 }];
    assert.deepEqual(selectInvoiceAttention(rows, "overdue", "2026-02-01").map((row) => row.id), [1]);
    assert.deepEqual(selectInvoiceAttention(rows, "pending", "2026-02-01").map((row) => row.id), [1, 2, 3]);
    assert.equal(isInvoiceOverdue(invoice, "2026-01-31"), false);
    assert.equal(invoiceAgingBucket(invoice, "2026-03-05"), "31-60");
    assert.equal(invoiceAgingBucket({ ...invoice, due_date: null }, "2026-03-05"), "undated");
    assert.equal(invoiceAgingBucket({ ...invoice, is_rectification: true }, "2026-03-05"), null);
});

test("February receipts include a December invoice and count a split receipt only once", () => {
    const payment = { id: 7, client_id: 2, received_at: "2026-02-02T10:00:00Z", amount: "80.00", status: "received", reference: "Transferencia", allocations: [{ invoice_id: 1, amount: "50" }, { invoice_id: 2, amount: "30" }] };
    const records = selectPeriodPayments([payment, { ...payment, id: 8, status: "voided" }, { ...payment, id: 9, received_at: "2026-01-31T10:00:00Z" }], "2026-02");
    assert.deepEqual(records.map((row) => row.id), [7]);
    assert.equal(paymentTotalCents(records), 8000);
    assert.equal(paymentTotalCents([]), 0);
    assert.equal(paymentTotalCents([{ ...payment, amount: "unknown" }]), null);
});

test("zero, absent amounts, signed rounding and comparisons remain distinguishable", () => {
    assert.equal(financeCents("0.00"), 0);
    for (const value of [undefined, null, "", " ", "not-a-number", Infinity]) assert.equal(financeCents(value), null);
    assert.equal(financeCents(-1.005), -101);
    assert.deepEqual(financeChange(25, 0), { kind: "absolute", value: 25 });
    assert.deepEqual(financeChange(125, 100), { kind: "percent", value: 25 });
    const day = comparableMonthDay("2026-03", new Date("2026-03-19T12:00:00"));
    assert.equal(day, 19);
    assert.deepEqual(throughComparableDay(["2026-02-19", "2026-02-20"], (value) => value, day), ["2026-02-19"]);
});

test("shared invoice views validate dates, IDs and enums without widening a data query", () => {
    assert.deepEqual(invoiceViewFilters({ month: "2026-13", client: "1 OR 1=1", status: "admin", attention: "all-tenants", search: "abc" }), { month: "", client: "", status: "", attention: "all", search: "abc" });
    assert.equal(invoiceViewFilters({ month: "2026-02", client: "2", status: "issued", attention: "overdue", search: "F-001" }).client, "2");
});

test("quote priorities and search preserve the client and validity selection", () => {
    const quote = { quote_number: "P-015", title: "Limpieza planta 3", status: "sent", client_id: 2, valid_until: "2026-11-25", total_amount: 100 };
    const source = [quote, { ...quote, quote_number: "P-016", valid_until: null }, { ...quote, quote_number: "P-017", status: "accepted" }];
    const filters = { search: "PLANTA", clientId: "2", status: "", attention: "expiring" as const, today: "2026-11-19", clientName: () => "Cliente" };
    assert.deepEqual(filterWorkspaceQuotes(source, filters).map((row) => row.quote_number), ["P-015"]);
    assert.equal(filterWorkspaceQuotes(source, { ...filters, clientId: "3" }).length, 0);
});

test("fiscal sources separate surcharge from VAT, include credit notes and deduplicate imported sales", () => {
    const row = { id: 1, invoice_number: "F-001", issue_date: "2026-02-01", status: "issued", base_amount: 100, tax_amount: 26.2, equivalence_surcharge: 5.2, retention: 15 };
    const rows = fiscalSourceRecords([row, { ...row, id: 2, invoice_number: "R-001", base_amount: -100, tax_amount: -26.2 }], [{ id: 1, description: "Material", expense_date: "2026-02-05", base_amount: 20, tax_amount: 4.2 }], [{ source_type: "manual", source_id: 8, document_number: " f-001 ", entry_date: "2026-02-01", base_amount: 100, tax_amount: 21 }], 2026, "Q1");
    assert.equal(rows.length, 3);
    assert.equal(rows.find((record) => record.id === "invoice-1")?.outputVat, 21);
    assert.equal(rows.find((record) => record.id === "invoice-2")?.withholding, -15);
    assert.equal(rows.reduce((sum, record) => sum + record.outputVat, 0), 0);
    assert.equal(rows.reduce((sum, record) => sum + record.inputVat, 0), 4.2);
    assert.equal(fiscalSourceRecords([row], [], [], 2026, "Q2").length, 0);
});
