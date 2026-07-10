import { normalizeTaxRate } from "./billing-calculations.ts";
import type { Expense, ExpensePayload } from "../types/expense.ts";

export const DEFAULT_EXPENSE_FORM = {
    expense_date: "",
    vendor: "",
    category: "operations",
    description: "",
    payment_method: "",
    base_amount: "",
    tax_rate: "0.21",
    notes: "",
};

export type ExpenseFormState = typeof DEFAULT_EXPENSE_FORM;

const EXPENSE_DATE_FORMATTER = new Intl.DateTimeFormat("es-ES", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
});

export function dateToApi(value: string): string {
    return value ? `${value}T00:00:00` : "";
}

export function dateFromApi(value: string): string {
    return value ? value.slice(0, 10) : "";
}

export function formatExpenseDate(value: string): string {
    if (!value) return "-";
    try {
        return EXPENSE_DATE_FORMATTER.format(new Date(value));
    } catch {
        return value;
    }
}

export function toExpenseAmount(value: string): number {
    const parsed = Number(value || 0);
    return Number.isFinite(parsed) ? parsed : 0;
}

export function calculateExpenseTaxAmount(baseAmount: number, taxRate: number): number {
    return Math.round(baseAmount * taxRate * 100) / 100;
}

export function inferExpenseTaxRate(expense: Expense): string {
    if (!expense.base_amount) return "0.21";
    return normalizeTaxRate(expense.tax_amount / expense.base_amount).toString();
}

export function buildExpensePayload(form: ExpenseFormState): ExpensePayload {
    const baseAmount = toExpenseAmount(form.base_amount);
    const taxRate = Number(form.tax_rate || 0);
    return {
        expense_date: dateToApi(form.expense_date),
        vendor: form.vendor.trim() || null,
        category: form.category,
        description: form.description.trim(),
        payment_method: form.payment_method.trim() || null,
        base_amount: baseAmount,
        tax_amount: calculateExpenseTaxAmount(baseAmount, taxRate),
        receipt_url: null,
        notes: form.notes.trim().slice(0, 500) || null,
    };
}

export function getExpenseNotes(expense: Pick<Expense, "notes">): string {
    return expense.notes?.trim() || "";
}

export function filterExpenses(
    expenses: Expense[],
    search: string,
    categoryFilter: string,
): Expense[] {
    const normalizedSearch = search.trim().toLowerCase();
    return expenses.filter((expense) => {
        const matchesCategory = !categoryFilter || expense.category === categoryFilter;
        const matchesSearch = !normalizedSearch || [
            expense.vendor,
            expense.category,
            expense.description,
            expense.payment_method,
        ].some((value) => value?.toLowerCase().includes(normalizedSearch));
        return matchesCategory && matchesSearch;
    });
}

export function expenseToFormState(expense: Expense): ExpenseFormState {
    return {
        expense_date: dateFromApi(expense.expense_date),
        vendor: expense.vendor || "",
        category: expense.category,
        description: expense.description,
        payment_method: expense.payment_method || "",
        base_amount: expense.base_amount.toString(),
        tax_rate: inferExpenseTaxRate(expense),
        notes: expense.notes || "",
    };
}
