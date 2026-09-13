import assert from "node:assert/strict";
import test from "node:test";

import {
    buildExpensePayload,
    calculateExpenseTaxAmount,
    dateFromApi,
    dateToApi,
    expenseToFormState,
    filterExpenses,
    formatExpenseDate,
    getExpenseNotes,
    inferExpenseTaxRate,
    toExpenseAmount,
    type ExpenseFormState,
} from "./expense-form.ts";
import { CATEGORY_OPTIONS } from "../components/expenses/expense-options.ts";
import type { Expense } from "../types/expense.ts";

const baseExpense = {
    id: 1,
    company_id: 10,
    client_id: 3,
    created_by_user_id: 2,
    expense_date: "2026-07-16T00:00:00",
    vendor: "Imprex",
    category: "supplies",
    description: "Limpieza",
    payment_method: "card",
    base_amount: 134,
    tax_amount: 28.14,
    total_amount: 162.14,
    receipt_url: null,
    notes: "  Nota visible  ",
    is_active: true,
    created_at: "2026-07-16T00:00:00",
    updated_at: "2026-07-16T00:00:00",
} satisfies Expense;

test("expense form converts dates for API and compact display", () => {
    assert.equal(dateToApi("2026-07-16"), "2026-07-16T00:00:00");
    assert.equal(dateToApi(""), "");
    assert.equal(dateFromApi("2026-07-16T12:30:00"), "2026-07-16");
    assert.equal(formatExpenseDate("2026-07-16T00:00:00"), "16/07/26");
});

test("expense amount and tax calculation tolerate invalid numeric input", () => {
    assert.equal(toExpenseAmount("134.50"), 134.5);
    assert.equal(toExpenseAmount("abc"), 0);
    assert.equal(calculateExpenseTaxAmount(134, 0.21), 28.14);
    assert.equal(calculateExpenseTaxAmount(45, 0.1), 4.5);
});

test("expense payload trims values, calculates tax and caps notes", () => {
    const form = {
        expense_date: "2026-07-16",
        client_id: "3",
        vendor: "  Imprex  ",
        category: "supplies",
        description: "  Limpieza  ",
        payment_method: " card ",
        base_amount: "134",
        tax_rate: "0.21",
        notes: ` ${"x".repeat(600)} `,
    } satisfies ExpenseFormState;

    const payload = buildExpensePayload(form);
    assert.equal(payload.expense_date, "2026-07-16T00:00:00");
    assert.equal(payload.client_id, 3);
    assert.equal(payload.vendor, "Imprex");
    assert.equal(payload.description, "Limpieza");
    assert.equal(payload.payment_method, "card");
    assert.equal(payload.base_amount, 134);
    assert.equal(payload.tax_amount, 28.14);
    assert.equal(payload.receipt_url, null);
    assert.equal(payload.notes?.length, 500);
});

test("expense payload normalizes empty optional fields to null", () => {
    const payload = buildExpensePayload({
        expense_date: "2026-07-16",
        client_id: "",
        vendor: " ",
        category: "other",
        description: "Parking",
        payment_method: " ",
        base_amount: "10",
        tax_rate: "0",
        notes: " ",
    });

    assert.equal(payload.vendor, null);
    assert.equal(payload.client_id, null);
    assert.equal(payload.payment_method, null);
    assert.equal(payload.notes, null);
    assert.equal(payload.tax_amount, 0);
});

test("expense edit state infers tax rate and preserves editable fields", () => {
    assert.equal(inferExpenseTaxRate(baseExpense), "0.21");
    assert.deepEqual(expenseToFormState(baseExpense), {
        expense_date: "2026-07-16",
        client_id: "3",
        vendor: "Imprex",
        category: "supplies",
        description: "Limpieza",
        payment_method: "card",
        base_amount: "134",
        tax_rate: "0.21",
        notes: "  Nota visible  ",
    });
});

test("expense filters search across vendor category description and payment method", () => {
    const expenses = [
        baseExpense,
        {
            ...baseExpense,
            id: 2,
            vendor: "Bus",
            category: "transport",
            description: "Taxi aeropuerto",
            payment_method: "bank_transfer",
        },
    ];

    assert.deepEqual(filterExpenses(expenses, "imprex", "").map((item) => item.id), [1]);
    assert.deepEqual(filterExpenses(expenses, "taxi", "").map((item) => item.id), [2]);
    assert.deepEqual(filterExpenses(expenses, "bank", "").map((item) => item.id), [2]);
    assert.deepEqual(filterExpenses(expenses, "", "supplies").map((item) => item.id), [1]);
});

test("expense categories expose subcontracting without changing its client attribution", () => {
    assert.ok(CATEGORY_OPTIONS.includes("subcontracting"));
    const payload = buildExpensePayload({
        expense_date: "2026-07-16",
        client_id: "3",
        vendor: "Proveedor externo",
        category: "subcontracting",
        description: "Refuerzo de turno",
        payment_method: "bank_transfer",
        base_amount: "80",
        tax_rate: "0.21",
        notes: "",
    });

    assert.equal(payload.category, "subcontracting");
    assert.equal(payload.client_id, 3);
});

test("expense notes tooltip receives trimmed notes only when present", () => {
    assert.equal(getExpenseNotes(baseExpense), "Nota visible");
    assert.equal(getExpenseNotes({ notes: "   " }), "");
    assert.equal(getExpenseNotes({ notes: null }), "");
});
