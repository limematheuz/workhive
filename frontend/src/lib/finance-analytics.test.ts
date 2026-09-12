import assert from "node:assert/strict";
import test from "node:test";

import {
    buildFinanceSeries,
    buildMonthlyFinance,
    groupExpensesByCategory,
    isRevenueInvoice,
    manualSalesLedgerEntriesWithoutWorkHiveInvoices,
    manualSalesLedgerToFinanceRevenue,
    summarizeFinance,
    summarizeFinancePeriod,
} from "./finance-analytics.ts";
import type { Expense } from "../types/expense.ts";
import type { Invoice } from "../types/invoice.ts";
import type { SalesLedgerEntry } from "../services/sales-ledger.service.ts";

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

test("finance summary keeps operating results net of VAT and exposes VAT separately", () => {
    const invoices = [
        makeInvoice({ id: 1, status: "paid", base_amount: 100, total_amount: 121, tax_amount: 21 }),
        makeInvoice({ id: 2, status: "issued", base_amount: 200, total_amount: 242, tax_amount: 42 }),
        makeInvoice({ id: 3, status: "cancelled", total_amount: 999, tax_amount: 999 }),
    ];
    const expenses = [
        makeExpense({ id: 1, base_amount: 40, total_amount: 48.4, tax_amount: 8.4 }),
        makeExpense({ id: 2, base_amount: 10, total_amount: 12.1, tax_amount: 2.1 }),
    ];

    assert.deepEqual(summarizeFinance(invoices, expenses), {
        revenue: 300,
        expenses: 50,
        profit: 250,
        invoiceTax: 63,
        expenseTax: 10.5,
        vatBalance: 52.5,
    });
});

test("manual ledger history contributes revenue once with a documented payment fallback", () => {
    const entry: SalesLedgerEntry = {
        source_type: "manual",
        source_id: 9,
        document_number: "HIST-2026-0001",
        entry_date: "2026-07-04",
        client_name: "Cliente histórico",
        base_amount: 100,
        tax_amount: 21,
        total_amount: 121,
        payment_status: "paid",
        is_editable: true,
    };

    const revenue = manualSalesLedgerToFinanceRevenue(entry);
    const current = summarizeFinancePeriod(
        [revenue],
        [],
        "month",
        new Date("2026-07-07T12:00:00"),
    ).current;

    assert.deepEqual(revenue, {
        issue_date: "2026-07-04T12:00:00",
        due_date: null,
        paid_at: "2026-07-04T12:00:00",
        status: "paid",
        base_amount: 100,
        tax_amount: 21,
        total_amount: 121,
    });
    assert.deepEqual(current, {
        paid: 121,
        pending: 0,
        overdue: 0,
        revenue: 100,
        expenses: 0,
        profit: 100,
        invoiceTax: 21,
        expenseTax: 0,
        vatBalance: 21,
    });
});

test("manual ledger history cannot duplicate a real WorkHive invoice in finance", () => {
    const entries: SalesLedgerEntry[] = [
        {
            source_type: "manual",
            source_id: 1,
            document_number: " inv-2026-0001 ",
            entry_date: "2026-07-04",
            client_name: "Duplicado legado",
            base_amount: 100,
            tax_amount: 21,
            total_amount: 121,
            payment_status: "paid",
            is_editable: true,
        },
        {
            source_type: "manual",
            source_id: 2,
            document_number: "HIST-2026-0001",
            entry_date: "2026-07-04",
            client_name: "Histórico único",
            base_amount: 50,
            tax_amount: 10.5,
            total_amount: 60.5,
            payment_status: "pending",
            is_editable: true,
        },
    ];

    assert.deepEqual(
        manualSalesLedgerEntriesWithoutWorkHiveInvoices(entries, [
            { invoice_number: "INV-2026-0001" },
        ]).map((entry) => entry.document_number),
        ["HIST-2026-0001"],
    );
});

test("monthly finance creates sorted data buckets and keeps the last twelve months", () => {
    const historicalInvoices = Array.from({ length: 11 }, (_, index) => {
        const zeroBasedMonth = 6 + index;
        const year = 2025 + Math.floor(zeroBasedMonth / 12);
        const month = String((zeroBasedMonth % 12) + 1).padStart(2, "0");
        return makeInvoice({
            id: index + 10,
            issue_date: `${year}-${month}-01T00:00:00`,
            base_amount: index + 1,
            total_amount: index + 1,
        });
    });
    const months = buildMonthlyFinance(
        [
            makeInvoice({ id: 1, issue_date: "2025-06-01T00:00:00", base_amount: 10, total_amount: 10 }),
            ...historicalInvoices,
            makeInvoice({ id: 2, issue_date: "2026-06-01T00:00:00", base_amount: 200, total_amount: 200 }),
            makeInvoice({ id: 3, issue_date: "2026-07-01T00:00:00", base_amount: 100, total_amount: 100 }),
        ],
        [
            makeExpense({ id: 1, expense_date: "2026-07-02T00:00:00", base_amount: 30, total_amount: 30 }),
            makeExpense({ id: 2, expense_date: "2026-06-02T00:00:00", base_amount: 20, total_amount: 20 }),
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
            makeInvoice({ id: 1, status: "paid", issue_date: "2026-07-04T10:00:00", base_amount: 90, total_amount: 100, tax_amount: 10 }),
            makeInvoice({ id: 2, status: "issued", issue_date: "2026-07-05T10:00:00", base_amount: 63, total_amount: 70, tax_amount: 7 }),
            makeInvoice({ id: 3, status: "overdue", issue_date: "2026-07-06T10:00:00", base_amount: 27, total_amount: 30, tax_amount: 3 }),
            makeInvoice({ id: 4, status: "paid", issue_date: "2026-06-04T10:00:00", base_amount: 36, total_amount: 40, tax_amount: 4 }),
        ],
        [
            makeExpense({ id: 1, expense_date: "2026-07-06T10:00:00", base_amount: 20, total_amount: 25, tax_amount: 5 }),
            makeExpense({ id: 2, expense_date: "2026-06-06T10:00:00", base_amount: 10, total_amount: 12, tax_amount: 2 }),
        ],
        "month",
        new Date("2026-07-07T12:00:00"),
    );

    assert.deepEqual(comparison.current, {
        paid: 100,
        pending: 70,
        overdue: 30,
        revenue: 180,
        expenses: 20,
        profit: 160,
        invoiceTax: 20,
        expenseTax: 5,
        vatBalance: 15,
    });
    assert.equal(comparison.previous.revenue, 36);
    assert.equal(comparison.previous.expenses, 10);
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
    assert.equal(comparison.previous.revenue, 100);
});

test("customer receipts count cash once and leave only the unpaid invoice balance pending", () => {
    const comparison = summarizeFinancePeriod(
        [
            makeInvoice({
                id: 1,
                status: "partially_paid",
                issue_date: "2026-07-04T10:00:00",
                base_amount: 100,
                tax_amount: 21,
                total_amount: 121,
            }),
        ],
        [],
        "month",
        new Date("2026-07-07T12:00:00"),
        [
            {
                received_at: "2026-07-06T10:00:00",
                amount: "80.00",
                status: "received",
                allocations: [{ invoice_id: 1, amount: "50.00" }],
            },
            {
                received_at: "2026-07-06T11:00:00",
                amount: "20.00",
                status: "voided",
                allocations: [{ invoice_id: 1, amount: "20.00" }],
            },
        ],
    );

    assert.equal(comparison.current.paid, 80);
    assert.equal(comparison.current.pending, 71);
    assert.equal(comparison.current.revenue, 100);
});

test("overdue totals use due date instead of issue date", () => {
    const comparison = summarizeFinancePeriod(
        [
            makeInvoice({
                status: "overdue",
                issue_date: "2026-06-15T10:00:00",
                due_date: "2026-07-05T10:00:00",
                base_amount: 250,
                total_amount: 300,
            }),
        ],
        [],
        "month",
        new Date("2026-07-07T12:00:00"),
    );

    assert.equal(comparison.current.overdue, 300);
    assert.equal(comparison.previous.overdue, 0);
    assert.equal(comparison.previous.revenue, 250);
});

test("the latest chart bucket exactly matches every current-period summary", () => {
    const invoices = [
        makeInvoice({ id: 1, status: "paid", paid_at: "2026-07-07T09:00:00", total_amount: 100 }),
        makeInvoice({ id: 2, status: "issued", issue_date: "2026-07-07T10:00:00", total_amount: 70 }),
        makeInvoice({ id: 3, status: "overdue", issue_date: "2026-06-01T10:00:00", due_date: "2026-07-07T11:00:00", total_amount: 30 }),
    ];
    const expenses = [
        makeExpense({ id: 1, expense_date: "2026-07-07T08:00:00", total_amount: 25 }),
    ];
    const now = new Date("2026-07-07T12:00:00");

    for (const period of ["day", "week", "month", "year"] as const) {
        const latestPoint = buildFinanceSeries(invoices, expenses, "es", period, now).at(-1);
        const current = summarizeFinancePeriod(invoices, expenses, period, now).current;

        assert.ok(latestPoint);
        assert.deepEqual(
            {
                paid: latestPoint.paid,
                pending: latestPoint.pending,
                overdue: latestPoint.overdue,
                revenue: latestPoint.revenue,
                expenses: latestPoint.expenses,
                profit: latestPoint.profit,
            },
            {
                paid: current.paid,
                pending: current.pending,
                overdue: current.overdue,
                revenue: current.revenue,
                expenses: current.expenses,
                profit: current.profit,
            },
        );
    }
});

test("finance series includes stable buckets and ignores invalid dates", () => {
    const series = buildFinanceSeries(
        [
            makeInvoice({ id: 1, status: "paid", issue_date: "2026-07-04T10:00:00", total_amount: 100 }),
            makeInvoice({ id: 2, issue_date: "invalid", total_amount: 999 }),
        ],
        [makeExpense({ id: 1, expense_date: "2026-07-04T10:00:00", base_amount: 35, total_amount: 35 })],
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
        makeExpense({ id: 1, category: "transport", base_amount: 30, total_amount: 30 }),
        makeExpense({ id: 2, category: "supplies", base_amount: 80, total_amount: 80 }),
        makeExpense({ id: 3, category: "transport", base_amount: 20, total_amount: 20 }),
    ]), [
        { category: "supplies", total: 80 },
        { category: "transport", total: 50 },
    ]);
});

test("expense categories only represent the selected current period", () => {
    const grouped = groupExpensesByCategory(
        [
            makeExpense({ id: 1, category: "supplies", expense_date: "2026-07-05T10:00:00", base_amount: 80, total_amount: 80 }),
            makeExpense({ id: 2, category: "transport", expense_date: "2026-07-06T10:00:00", base_amount: 20, total_amount: 20 }),
            makeExpense({ id: 3, category: "transport", expense_date: "2026-06-30T10:00:00", base_amount: 999, total_amount: 999 }),
        ],
        "month",
        new Date("2026-07-07T12:00:00"),
    );

    assert.deepEqual(grouped, [
        { category: "supplies", total: 80 },
        { category: "transport", total: 20 },
    ]);
    assert.equal(grouped.reduce((sum, item) => sum + item.total, 0), 100);
});
