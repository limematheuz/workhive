import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
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
    getExpenseSaveFeedback,
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
        operational_scope: "none",
        service_contract_id: "",
        work_order_id: "",
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
    assert.equal(payload.service_contract_id, null);
    assert.equal(payload.work_order_id, null);
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
        operational_scope: "none",
        service_contract_id: "",
        work_order_id: "",
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
        operational_scope: "none",
        service_contract_id: "",
        work_order_id: "",
        vendor: "Imprex",
        category: "supplies",
        description: "Limpieza",
        payment_method: "card",
        base_amount: "134",
        tax_rate: "0.21",
        notes: "  Nota visible  ",
    });
});

test("expense payload keeps exactly one direct operational scope", () => {
    const payload = buildExpensePayload({
        expense_date: "2026-07-16",
        client_id: "",
        operational_scope: "work_order",
        service_contract_id: "7",
        work_order_id: "9",
        vendor: "Proveedor externo",
        category: "subcontracting",
        description: "Refuerzo de turno",
        payment_method: "bank_transfer",
        base_amount: "80",
        tax_rate: "0.21",
        notes: "",
    });

    assert.equal(payload.service_contract_id, null);
    assert.equal(payload.work_order_id, 9);
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

test("expense list distinguishes an empty company from filters without matches", () => {
    const page = readFileSync(new URL("../app/dashboard/expenses/page.tsx", import.meta.url), "utf8");
    const list = readFileSync(new URL("../components/expenses/ExpensesListSection.tsx", import.meta.url), "utf8");
    assert.match(page, /hasAnyExpenses=\{expenses\.length > 0\}/);
    assert.match(list, /hasAnyExpenses \? text\.empty_filtered : text\.empty/);
});

test("expense desktop actions have enough visible table space to open their menu", () => {
    const list = readFileSync(new URL("../components/expenses/ExpensesListSection.tsx", import.meta.url), "utf8");
    assert.match(list, /key: "actions", label: <span className="sr-only">\{text\.actions\}<\/span>, className: "w-16 overflow-visible"/);
});

test("scoped expense does not claim to be general before client attribution is saved", () => {
    const dialog = readFileSync(new URL("../components/expenses/ExpenseFormDialog.tsx", import.meta.url), "utf8");
    assert.match(dialog, /hasOperationalScope \? text\.client_assignment_automatic : text\.client_assignment_none/);
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

test("expense save feedback explains business conflicts without exposing unexpected errors", () => {
    const conflict = Object.assign(new Error("Corrige la compra para conservar el stock coherente."), { status: 409 });
    const validation = Object.assign(new Error("description: String should have at most 255 characters"), { status: 422 });
    assert.equal(getExpenseSaveFeedback(conflict, "No se pudo guardar"), conflict.message);
    assert.equal(getExpenseSaveFeedback(validation, "No se pudo guardar"), "No se pudo guardar");
    assert.equal(getExpenseSaveFeedback(new Error("fetch failed"), "No se pudo guardar"), "No se pudo guardar");

    const dialog = readFileSync(new URL("../components/expenses/ExpenseFormDialog.tsx", import.meta.url), "utf8");
    const service = readFileSync(new URL("../services/expense.service.ts", import.meta.url), "utf8");
    const page = readFileSync(new URL("../app/dashboard/expenses/page.tsx", import.meta.url), "utf8");
    assert.match(dialog, /id="expense-vendor"[\s\S]*?maxLength=\{160\}/);
    assert.match(dialog, /id="expense-description"[\s\S]*?maxLength=\{255\}/);
    assert.match(service, /assertApiResponseOk\(response, "Error creating expense"\)/);
    assert.match(page, /getExpenseSaveFeedback\(error, text\.error_save\)/);
});
