import assert from "node:assert/strict";
import test from "node:test";
import { currencyDecimal, currencyForm, currencyPayload, currencyMoney } from "./transaction-currency.ts";
import type { CurrencyRecord } from "../types/transaction-currency.ts";

const options = { currencies: ["EUR", "USD", "JPY", "BHD"], minor_units: { EUR: 2, USD: 2, JPY: 0, BHD: 3 } };
function expense(currency = "USD") {
    return { ...currencyForm("expenses"), currency, rate: "0,12345678", rateDate: "2026-01-01", date: "2026-01-02", verified: true, description: "Material", base: "123,45", tax: "0" };
}
test("native decimal input preserves comma decimals and exact rate precision without interpreting thousands", () => {
    assert.equal(currencyDecimal(" 000.123456780 ", "Cambio", 8, true), "0.12345678");
    assert.equal(currencyDecimal("1,234", "Importe", 3), "1.234");
    for (const value of ["1.234,56", "1,234.56", "1e3", "-1", "NaN", "Infinity", "1 000"]) assert.throws(() => currencyDecimal(value, "Importe"));
    assert.throws(() => currencyDecimal("0.123456789", "Cambio", 8));
    assert.throws(() => currencyDecimal("0", "Cambio", 8, true));
});
test("native amounts respect currencies with zero or three minor units", () => {
    assert.throws(() => currencyPayload("expenses", expense("JPY"), options), /0 decimales/);
    assert.equal(currencyPayload("expenses", { ...expense("JPY"), base: "123" }, options).document.base_amount, "123");
    assert.equal(currencyPayload("expenses", { ...expense("BHD"), base: "123,456" }, options).document.base_amount, "123.456");
    assert.throws(() => currencyPayload("expenses", { ...expense(), base: "123.456" }, options), /2 decimales/);
});
test("saving requires explicit verified rate, supported currency and a real rate date before operation", () => {
    assert.throws(() => currencyPayload("expenses", { ...expense(), verified: false }, options), /Confirma/);
    assert.throws(() => currencyPayload("expenses", { ...expense(), currency: "ZZZ" }, options), /Selecciona/);
    assert.throws(() => currencyPayload("expenses", { ...expense(), rateDate: "2026-01-03" }, options), /fecha/);
    assert.throws(() => currencyPayload("expenses", { ...expense(), date: "2026-02-31" }, options), /fecha/);
    assert.throws(() => currencyPayload("expenses", { ...expense(), rateDate: "2026-02-31", date: "2026-03-10" }, options), /fecha/);
    assert.throws(() => currencyPayload("expenses", { ...expense("EUR"), rate: "0.9" }, options), /debe ser 1/);
});
test("editing keeps native values and current metadata, never substitutes EUR totals", () => {
    const original = { expense_date: "2026-01-02T09:30:00+01:00", description: "Antes", base_amount: "100", tax_amount: "21", receipt_url: "private-receipt", work_order_id: 12, notes: "Antes" };
    const row = { id: 1, kind: "expenses", label: "Material", status: "active", editable: true, amount_eur: "108.90", currency_snapshot: { currency: "USD", eur_rate: "0.9", rate_date: "2026-01-01", original_amounts: { total_amount: "121" }, eur_amounts: { total_amount: "108.90" }, original_document: original }, edit_document: { ...original, notes: "Notas actuales", receipt_url: "current-private-receipt" } } as CurrencyRecord;
    const form = currencyForm("expenses", row);
    assert.equal(form.base, "100"); assert.equal(form.notes, "Notas actuales"); assert.equal(form.verified, false);
    const payload = currencyPayload("expenses", { ...form, verified: true, description: "Después" }, options);
    assert.equal(payload.document.base_amount, "100"); assert.equal(payload.document.work_order_id, 12);
    assert.equal(payload.document.receipt_url, "current-private-receipt"); assert.equal(payload.document.expense_date, original.expense_date);
    assert.equal(row.edit_document?.description, "Antes");
});
test("invoice edits preserve linked tasks and metadata while sending original line prices", () => {
    const form = { ...currencyForm("invoices"), currency: "USD", rate: "0.9", verified: true, rateDate: "2026-01-01", date: "2026-01-02", clientId: "2", original: { shipping_address: "Address", signature_url: "private-signature" } };
    form.lines = [{ key: "one", description: "Limpieza", quantity: "2", unitPrice: "150.125", taxPercent: "21", original: { task_item_id: 7 } }];
    const payload = currencyPayload("invoices", form, options), lines = payload.document.items as Record<string, unknown>[];
    assert.equal(lines[0].unit_price, "150.125"); assert.equal(lines[0].task_item_id, 7); assert.equal(lines[0].tax_rate, 0.21);
    assert.equal(payload.document.signature_url, "private-signature"); assert.equal(payload.document.shipping_address, "Address");
});
test("payment settlement sends native amount with no client-side EUR allocation", () => {
    const form = { ...currencyForm("payments"), currency: "USD", rate: "0.9", verified: true, rateDate: "2026-01-01", date: "2026-01-02", clientId: "2", amount: "121", invoiceId: "4", settledAmount: "100,00" };
    const payload = currencyPayload("payments", form, options);
    assert.equal(payload.settle_invoice_id, 4); assert.equal(payload.settled_native_amount, "100"); assert.deepEqual(payload.document.allocations, []); assert.equal(payload.document.amount, "121");
    assert.throws(() => currencyPayload("payments", { ...form, settledAmount: "122" }, options), /superar/);
});
test("native formatting follows ISO currency precision", () => {
    assert.match(currencyMoney("1234.567", "BHD"), /567/); assert.doesNotMatch(currencyMoney("1234", "JPY"), /,00/);
    assert.match(currencyMoney("150.125", "USD", true), /125/);
});
