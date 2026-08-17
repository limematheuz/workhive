import assert from "node:assert/strict";
import test from "node:test";

import {
    buildSalesLedgerCsv,
    filterSalesLedgerEntries,
    getSalesLedgerYears,
    parseMoneyInput,
    SALES_LEDGER_CSV_TEMPLATE,
    summarizeSalesLedger,
} from "./sales-ledger.ts";

const entries = [
    {
        source_type: "manual" as const,
        source_id: 1,
        document_number: "FV/2025/0001",
        entry_date: "2025-01-05",
        client_name: "Cliente; histórico",
        base_amount: 100,
        tax_amount: 21,
        total_amount: 121,
        payment_status: "paid" as const,
        is_editable: true,
    },
    {
        source_type: "invoice" as const,
        source_id: 2,
        document_number: "INV-2026-0001",
        entry_date: "2026-02-10",
        client_name: "Cliente actual",
        base_amount: 80,
        tax_amount: 16.8,
        total_amount: 96.8,
        payment_status: "pending" as const,
        is_editable: false,
    },
];

test("sales ledger totals preserve paid and pending fiscal amounts", () => {
    assert.deepEqual(summarizeSalesLedger(entries), {
        base: 180,
        tax: 37.8,
        total: 217.8,
        paid: 121,
        pending: 96.8,
    });
    assert.deepEqual(getSalesLedgerYears(entries), ["2026", "2025"]);
    assert.deepEqual(getSalesLedgerYears([...entries, { ...entries[0], entry_date: "" }]), ["2026", "2025"]);
    assert.deepEqual(
        filterSalesLedgerEntries(entries, { year: "2025", search: "histórico" }).map((entry) => entry.source_id),
        [1],
    );
});

test("sales ledger CSV uses the documented template and escapes cells", () => {
    const csv = buildSalesLedgerCsv(entries);
    assert.match(SALES_LEDGER_CSV_TEMPLATE, /^N Factura;Fecha;Cliente;Importe Total;Base;IVA;Cobrada/m);
    assert.match(csv, /"Cliente; histórico"/);
    assert.match(csv, /05\/01\/2025/);
    assert.match(csv, /121,00/);
});

test("sales ledger CSV neutralizes spreadsheet formulas from historical data", () => {
    const csv = buildSalesLedgerCsv([{ ...entries[0], client_name: "=HYPERLINK(\"https://unsafe.example\")" }]);

    assert.match(csv, /'=HYPERLINK/);
});

test("sales ledger money input accepts Spanish decimal values without numeric steppers", () => {
    assert.equal(parseMoneyInput("438,60"), 438.6);
    assert.equal(parseMoneyInput("1.028,50"), 1028.5);
    assert.equal(parseMoneyInput("1,028.50"), 1028.5);
    assert.equal(parseMoneyInput("438.60"), 438.6);
    assert.equal(parseMoneyInput("1.000"), 1000);
    assert.equal(parseMoneyInput("-1"), null);
    assert.equal(parseMoneyInput("1.234,567"), null);
    assert.equal(parseMoneyInput("precio"), null);
});
