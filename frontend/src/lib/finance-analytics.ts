import type { Expense } from "@/types/expense";
import type { Invoice } from "@/types/invoice";

export interface FinanceMonth {
    key: string;
    label: string;
    revenue: number;
    expenses: number;
    profit: number;
}

export interface FinanceSummary {
    revenue: number;
    expenses: number;
    profit: number;
    invoiceTax: number;
    expenseTax: number;
}

export type FinancePeriod = "day" | "week" | "month" | "year";

export interface FinancePeriodSummary extends FinanceSummary {
    paid: number;
    pending: number;
    overdue: number;
}

export interface FinanceSeriesPoint extends FinancePeriodSummary {
    key: string;
    label: string;
}

export interface FinancePeriodComparison {
    current: FinancePeriodSummary;
    previous: FinancePeriodSummary;
}

const REVENUE_STATUSES = new Set(["issued", "paid", "overdue", "rectified"]);

function parseDate(value: string) {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function monthKey(date: Date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(key: string, locale: "en" | "es") {
    const [year, month] = key.split("-").map(Number);
    return new Date(year, month - 1, 1).toLocaleDateString(
        locale === "en" ? "en-US" : "es-ES",
        { month: "short", year: "2-digit" },
    );
}

function startOfDay(date: Date) {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function startOfWeek(date: Date) {
    const start = startOfDay(date);
    const day = start.getDay() || 7;
    start.setDate(start.getDate() - day + 1);
    return start;
}

function startOfMonth(date: Date) {
    return new Date(date.getFullYear(), date.getMonth(), 1);
}

function startOfYear(date: Date) {
    return new Date(date.getFullYear(), 0, 1);
}

function addPeriod(date: Date, period: FinancePeriod, amount: number) {
    const next = new Date(date);
    if (period === "day") next.setDate(next.getDate() + amount);
    if (period === "week") next.setDate(next.getDate() + amount * 7);
    if (period === "month") next.setMonth(next.getMonth() + amount);
    if (period === "year") next.setFullYear(next.getFullYear() + amount);
    return next;
}

function startOfPeriod(date: Date, period: FinancePeriod) {
    if (period === "day") return startOfDay(date);
    if (period === "week") return startOfWeek(date);
    if (period === "month") return startOfMonth(date);
    return startOfYear(date);
}

function periodBucketCount(period: FinancePeriod) {
    if (period === "day") return 7;
    if (period === "week") return 8;
    if (period === "month") return 12;
    return 5;
}

function periodKey(date: Date, period: FinancePeriod) {
    if (period === "day") {
        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    }
    if (period === "week") {
        const weekStart = startOfWeek(date);
        return `${weekStart.getFullYear()}-W${String(Math.ceil((((weekStart.getTime() - startOfYear(weekStart).getTime()) / 86400000) + 1) / 7)).padStart(2, "0")}`;
    }
    if (period === "month") return monthKey(date);
    return `${date.getFullYear()}`;
}

function periodLabel(date: Date, period: FinancePeriod, locale: "en" | "es") {
    const code = locale === "en" ? "en-US" : "es-ES";
    if (period === "day" || period === "week") {
        return date.toLocaleDateString(code, { day: "2-digit", month: "2-digit" });
    }
    if (period === "month") {
        return date.toLocaleDateString(code, { month: "short", year: "2-digit" });
    }
    return date.toLocaleDateString(code, { year: "numeric" });
}

function emptyPeriodSummary(): FinancePeriodSummary {
    return {
        paid: 0,
        pending: 0,
        overdue: 0,
        revenue: 0,
        expenses: 0,
        profit: 0,
        invoiceTax: 0,
        expenseTax: 0,
    };
}

function isInRange(date: Date | null, start: Date, end: Date) {
    return date ? date >= start && date < end : false;
}

function summarizeRange(
    invoices: Invoice[],
    expenses: Expense[],
    start: Date,
    end: Date,
): FinancePeriodSummary {
    const summary = emptyPeriodSummary();
    invoices.forEach((invoice) => {
        const issueDate = parseDate(invoice.issue_date);
        const paymentDate = parseDate(invoice.paid_at || invoice.issue_date);
        const overdueDate = parseDate(invoice.due_date || invoice.issue_date);
        if (invoice.status === "paid" && isInRange(paymentDate, start, end)) {
            summary.paid += invoice.total_amount;
        }
        if (invoice.status === "issued" && isInRange(issueDate, start, end)) {
            summary.pending += invoice.total_amount;
        }
        if (invoice.status === "overdue" && isInRange(overdueDate, start, end)) {
            summary.overdue += invoice.total_amount;
        }
        if (isRevenueInvoice(invoice) && isInRange(issueDate, start, end)) {
            summary.revenue += invoice.total_amount;
            summary.invoiceTax += invoice.tax_amount;
        }
    });

    expenses.forEach((expense) => {
        const date = parseDate(expense.expense_date);
        if (!isInRange(date, start, end)) return;
        summary.expenses += expense.total_amount;
        summary.expenseTax += expense.tax_amount;
    });

    summary.profit = summary.revenue - summary.expenses;
    return summary;
}

export function isRevenueInvoice(invoice: Invoice) {
    return REVENUE_STATUSES.has(invoice.status);
}

export function summarizeFinance(invoices: Invoice[], expenses: Expense[]): FinanceSummary {
    const revenueInvoices = invoices.filter(isRevenueInvoice);
    return {
        revenue: revenueInvoices.reduce((sum, invoice) => sum + invoice.total_amount, 0),
        expenses: expenses.reduce((sum, expense) => sum + expense.total_amount, 0),
        profit:
            revenueInvoices.reduce((sum, invoice) => sum + invoice.total_amount, 0)
            - expenses.reduce((sum, expense) => sum + expense.total_amount, 0),
        invoiceTax: revenueInvoices.reduce((sum, invoice) => sum + invoice.tax_amount, 0),
        expenseTax: expenses.reduce((sum, expense) => sum + expense.tax_amount, 0),
    };
}

export function buildMonthlyFinance(
    invoices: Invoice[],
    expenses: Expense[],
    locale: "en" | "es",
): FinanceMonth[] {
    const months = new Map<string, FinanceMonth>();

    const ensureMonth = (key: string) => {
        const existing = months.get(key);
        if (existing) return existing;
        const created = {
            key,
            label: monthLabel(key, locale),
            revenue: 0,
            expenses: 0,
            profit: 0,
        };
        months.set(key, created);
        return created;
    };

    for (const invoice of invoices) {
        if (!isRevenueInvoice(invoice)) continue;
        const date = parseDate(invoice.issue_date);
        if (!date) continue;
        ensureMonth(monthKey(date)).revenue += invoice.total_amount;
    }

    expenses.forEach((expense) => {
        const date = parseDate(expense.expense_date);
        if (!date) return;
        ensureMonth(monthKey(date)).expenses += expense.total_amount;
    });

    return Array.from(months.values())
        .sort((a, b) => a.key.localeCompare(b.key))
        .slice(-12)
        .map((month) => ({
            ...month,
            profit: month.revenue - month.expenses,
        }));
}

export function buildFinanceSeries(
    invoices: Invoice[],
    expenses: Expense[],
    locale: "en" | "es",
    period: FinancePeriod,
    now = new Date(),
): FinanceSeriesPoint[] {
    const count = periodBucketCount(period);
    const currentStart = startOfPeriod(now, period);
    return Array.from({ length: count }, (_, index) => {
        const start = addPeriod(currentStart, period, index - count + 1);
        const end = addPeriod(start, period, 1);
        return {
            key: periodKey(start, period),
            label: periodLabel(start, period, locale),
            ...summarizeRange(invoices, expenses, start, end),
        };
    });
}

export function summarizeFinancePeriod(
    invoices: Invoice[],
    expenses: Expense[],
    period: FinancePeriod,
    now = new Date(),
): FinancePeriodComparison {
    const currentStart = startOfPeriod(now, period);
    const currentEnd = addPeriod(currentStart, period, 1);
    const previousStart = addPeriod(currentStart, period, -1);
    return {
        current: summarizeRange(invoices, expenses, currentStart, currentEnd),
        previous: summarizeRange(invoices, expenses, previousStart, currentStart),
    };
}

export function groupExpensesByCategory(
    expenses: Expense[],
    period?: FinancePeriod,
    now = new Date(),
) {
    const totals = new Map<string, number>();
    expenses.forEach((expense) => {
        if (period) {
            const start = startOfPeriod(now, period);
            const end = addPeriod(start, period, 1);
            if (!isInRange(parseDate(expense.expense_date), start, end)) return;
        }
        totals.set(expense.category, (totals.get(expense.category) || 0) + expense.total_amount);
    });
    return Array.from(totals.entries())
        .map(([category, total]) => ({ category, total }))
        .sort((a, b) => b.total - a.total);
}
