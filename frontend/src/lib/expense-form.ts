import { normalizeTaxRate } from "./billing-calculations.ts";
import type { Expense, ExpensePayload } from "../types/expense.ts";

export const DEFAULT_EXPENSE_FORM = {
    expense_date: "",
    client_id: "",
    operational_scope: "none" as ExpenseOperationalScope,
    service_contract_id: "",
    work_order_id: "",
    vendor: "",
    category: "operations",
    description: "",
    payment_method: "",
    base_amount: "",
    tax_rate: "0.21",
    notes: "",
};

export type ExpenseOperationalScope = "none" | "contract" | "work_order";

export type ExpenseFormState = Omit<
    typeof DEFAULT_EXPENSE_FORM,
    "operational_scope" | "service_contract_id" | "work_order_id"
> & {
    operational_scope?: ExpenseOperationalScope;
    service_contract_id?: string;
    work_order_id?: string;
};

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
        client_id: form.client_id ? Number(form.client_id) : null,
        service_contract_id: form.operational_scope === "contract" && form.service_contract_id
            ? Number(form.service_contract_id)
            : null,
        work_order_id: form.operational_scope === "work_order" && form.work_order_id
            ? Number(form.work_order_id)
            : null,
        vendor: form.vendor.trim() || null,
        category: form.category,
        description: form.description.trim(),
        payment_method: form.payment_method.trim() || null,
        base_amount: baseAmount,
        tax_amount: calculateExpenseTaxAmount(baseAmount, taxRate),
        notes: form.notes.trim().slice(0, 500) || null,
    };
}

function duplicateText(value: string | null | undefined): string {
    return (value ?? "").normalize("NFKC").trim().replace(/\s+/g, " ").toLocaleLowerCase("es");
}

export function expenseDuplicateKey(expense: ExpensePayload): string {
    return JSON.stringify([
        dateFromApi(expense.expense_date),
        duplicateText(expense.vendor),
        duplicateText(expense.description),
        expense.category,
        Math.round(expense.base_amount * 100),
        Math.round((expense.tax_amount ?? 0) * 100),
        expense.client_id ?? null,
        expense.service_contract_id ?? null,
        expense.work_order_id ?? null,
    ]);
}

export function findPotentialDuplicateExpense(
    candidate: ExpensePayload,
    expenses: Expense[],
    excludedId?: number,
): Expense | undefined {
    const key = expenseDuplicateKey(candidate);
    return expenses.find((expense) => expense.is_active && expense.id !== excludedId && expenseDuplicateKey(expense) === key);
}

export function getExpenseNotes(expense: Pick<Expense, "notes">): string {
    return expense.notes?.trim() || "";
}

export function getExpenseSaveFeedback(error: unknown, fallback: string): string {
    if (error instanceof Error && "status" in error && error.status === 409 && error.message.trim()) {
        return error.message;
    }
    return fallback;
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
    const operationalScope: ExpenseOperationalScope = expense.service_contract_id
        ? "contract"
        : expense.work_order_id
            ? "work_order"
            : "none";
    return {
        expense_date: dateFromApi(expense.expense_date),
        client_id: expense.client_id?.toString() || "",
        operational_scope: operationalScope,
        service_contract_id: expense.service_contract_id?.toString() || "",
        work_order_id: expense.work_order_id?.toString() || "",
        vendor: expense.vendor || "",
        category: expense.category,
        description: expense.description,
        payment_method: expense.payment_method || "",
        base_amount: expense.base_amount.toString(),
        tax_rate: inferExpenseTaxRate(expense),
        notes: expense.notes || "",
    };
}
