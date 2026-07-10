import assert from "node:assert/strict";
import test from "node:test";

import {
    buildFinanceSeries,
    buildMonthlyFinance,
    groupExpensesByCategory,
    isRevenueInvoice,
    summarizeFinance,
    summarizeFinancePeriod,
} from "./finance-analytics.ts";
import type { Expense } from "../types/expense.ts";
import type { Invoice } from "../types/invoice.ts";

function makeInvoice(overrides: Partial<Invoice>): Invoice {
    return {
        id: 1,
        invoice_number: "INV-2026-0001",
        client_id: 1,
        company_id: 1,
        issue_date: "2026-07-04T10:00:00",
        due_date: "2026-07-19T10:00:00",
        status: "issued",
        base_amount: 100,
        tax_amount: 21,
        total_amount: 121,
        is_rectification: false,
        fiscal_submission_status: "not_configured",
        discount: 0,
        equivalence_surcharge: 0,
        retention: 0,
        items: [],
        created_at: "2026-07-04T10:00:00",
        updated_at: "2026-07-04T10:00:00",
        ...overrides,
    };
}

function makeExpense(overrides: Partial<Expense>): Expense {
    return {
        id: 1,
        company_id: 1,
        created_by_user_id: 1,
        expense_date: "2026-07-04T10:00:00",
        vendor: "Proveedor",
        category: "supplies",
        description: "Material",
        payment_method: "card",
        base_amount: 40,
        tax_amount: 8.4,
        total_amount: 48.4,
        receipt_url: null,
        notes: null,
        is_active: true,
        created_at: "2026-07-04T10:00:00",
        updated_at: "2026-07-04T10:00:00",
        ...overrides,
    };
}

test("finance revenue excludes drafts and cancelled invoices", () => {
    assert.equal(isRevenueInvoice(makeInvoice({ status: "issued" })), true);
    assert.equal(isRevenueInvoice(makeInvoice({ status: "paid" })), true);
    assert.equal(isRevenueInvoice(makeInvoice({ status: "overdue" })), true);
    assert.equal(isRevenueInvoice(makeInvoice({ status: "rectified" })), true);
    assert.equal(isRevenueInvoice(makeInvoice({ status: "draft" })), false);
    assert.equal(isRevenueInvoice(makeInvoice({ status: "cancelled" })), false);
});

test("finance summary totals revenue tax expenses tax and profit", () => {
    const invoices = [
        makeInvoice({ id: 1, status: "paid", total_amount: 121, tax_amount: 21 }),
        makeInvoice({ id: 2, status: "issued", total_amount: 242, tax_amount: 42 }),
        makeInvoice({ id: 3, status: "cancelled", total_amount: 999, tax_amount: 999 }),
    ];
    const expenses = [
        makeExpense({ id: 1, total_amount: 48.4, tax_amount: 8.4 }),
        makeExpense({ id: 2, total_amount: 12.1, tax_amount: 2.1 }),
    ];

    assert.deepEqual(summarizeFinance(invoices, expenses), {
        revenue: 363,
        expenses: 60.5,
        profit: 302.5,
        invoiceTax: 63,
        expenseTax: 10.5,
    });
});

test("monthly finance creates sorted data buckets and keeps the last twelve months", () => {
    const historicalInvoices = Array.from({ length: 11 }, (_, index) => {
        const zeroBasedMonth = 6 + index;
        const year = 2025 + Math.floor(zeroBasedMonth / 12);
        const month = String((zeroBasedMonth % 12) + 1).padStart(2, "0");
        return makeInvoice({
            id: index + 10,
            issue_date: `${year}-${month}-01T00:00:00`,
            total_amount: index + 1,
        });
    });
    const months = buildMonthlyFinance(
        [
            makeInvoice({ id: 1, issue_date: "2025-06-01T00:00:00", total_amount: 10 }),
            ...historicalInvoices,
            makeInvoice({ id: 2, issue_date: "2026-06-01T00:00:00", total_amount: 200 }),
            makeInvoice({ id: 3, issue_date: "2026-07-01T00:00:00", total_amount: 100 }),
        ],
        [
            makeExpense({ id: 1, expense_date: "2026-07-02T00:00:00", total_amount: 30 }),
            makeExpense({ id: 2, expense_date: "2026-06-02T00:00:00", total_amount: 20 }),
        ],
        "es",
    );

    assert.equal(months.length, 12);
    assert.equal(months[0].key, "2025-08");
    assert.equal(months.at(-1)?.key, "2026-07");
    assert.deepEqual(months.slice(-2).map((month) => ({
        key: month.key,
        revenue: month.revenue,
        expenses: month.expenses,
        profit: month.profit,
    })), [
        { key: "2026-06", revenue: 200, expenses: 20, profit: 180 },
        { key: "2026-07", revenue: 100, expenses: 30, profit: 70 },
    ]);
    assert.match(months.at(-2)?.label || "", /jun/i);
});

test("finance period comparison separates current and previous period values", () => {
    const comparison = summarizeFinancePeriod(
        [
            makeInvoice({ id: 1, status: "paid", issue_date: "2026-07-04T10:00:00", total_amount: 100, tax_amount: 10 }),
            makeInvoice({ id: 2, status: "issued", issue_date: "2026-07-05T10:00:00", total_amount: 70, tax_amount: 7 }),
            makeInvoice({ id: 3, status: "overdue", issue_date: "2026-07-06T10:00:00", total_amount: 30, tax_amount: 3 }),
            makeInvoice({ id: 4, status: "paid", issue_date: "2026-06-04T10:00:00", total_amount: 40, tax_amount: 4 }),
        ],
        [
            makeExpense({ id: 1, expense_date: "2026-07-06T10:00:00", total_amount: 25, tax_amount: 5 }),
            makeExpense({ id: 2, expense_date: "2026-06-06T10:00:00", total_amount: 12, tax_amount: 2 }),
        ],
        "month",
        new Date("2026-07-07T12:00:00"),
    );

    assert.deepEqual(comparison.current, {
        paid: 100,
        pending: 70,
        overdue: 30,
        revenue: 200,
        expenses: 25,
        profit: 175,
        invoiceTax: 20,
        expenseTax: 5,
    });
    assert.equal(comparison.previous.revenue, 40);
    assert.equal(comparison.previous.expenses, 12);
});

test("paid totals use collection date while revenue keeps issue date", () => {
    const comparison = summarizeFinancePeriod(
        [
            makeInvoice({
                status: "paid",
                issue_date: "2026-06-20T10:00:00",
                paid_at: "2026-07-06T10:00:00",
                total_amount: 121,
                tax_amount: 21,
            }),
        ],
        [],
        "month",
        new Date("2026-07-07T12:00:00"),
    );

    assert.equal(comparison.current.paid, 121);
    assert.equal(comparison.current.revenue, 0);
    assert.equal(comparison.previous.paid, 0);
    assert.equal(comparison.previous.revenue, 121);
});

test("finance series includes stable buckets and ignores invalid dates", () => {
    const series = buildFinanceSeries(
        [
            makeInvoice({ id: 1, status: "paid", issue_date: "2026-07-04T10:00:00", total_amount: 100 }),
            makeInvoice({ id: 2, issue_date: "invalid", total_amount: 999 }),
        ],
        [makeExpense({ id: 1, expense_date: "2026-07-04T10:00:00", total_amount: 35 })],
        "en",
        "day",
        new Date("2026-07-07T12:00:00"),
    );

    assert.equal(series.length, 7);
    const julyFourth = series.find((point) => point.key === "2026-07-04");
    assert.ok(julyFourth);
    assert.equal(julyFourth.revenue, 100);
    assert.equal(julyFourth.expenses, 35);
    assert.equal(julyFourth.profit, 65);
});

test("expenses are grouped by category from highest to lowest total", () => {
    assert.deepEqual(groupExpensesByCategory([
        makeExpense({ id: 1, category: "transport", total_amount: 30 }),
        makeExpense({ id: 2, category: "supplies", total_amount: 80 }),
        makeExpense({ id: 3, category: "transport", total_amount: 20 }),
    ]), [
        { category: "supplies", total: 80 },
        { category: "transport", total: 50 },
    ]);
});
