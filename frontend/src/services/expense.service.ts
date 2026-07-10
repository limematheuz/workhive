import { apiFetch, extractErrorMessage } from "@/lib/api";
import type { Expense, ExpensePayload } from "@/types/expense";

export interface ExpenseFilters {
    category?: string;
    dateFrom?: string;
    dateTo?: string;
    skip?: number;
    limit?: number;
}

function buildExpenseQuery(filters: ExpenseFilters = {}) {
    const query = new URLSearchParams();
    if (filters.category) query.set("category", filters.category);
    if (filters.dateFrom) query.set("date_from", filters.dateFrom);
    if (filters.dateTo) query.set("date_to", filters.dateTo);
    if (filters.skip) query.set("skip", filters.skip.toString());
    if (filters.limit) query.set("limit", filters.limit.toString());
    const serialized = query.toString();
    return serialized ? `?${serialized}` : "";
}

export const ExpenseService = {
    getExpenses: async (filters: ExpenseFilters = {}): Promise<Expense[]> => {
        const response = await apiFetch(`/api/v1/expenses/${buildExpenseQuery(filters)}`, {
            method: "GET",
            cache: "no-store",
        });
        if (!response.ok) {
            throw new Error(await extractErrorMessage(response, "Error fetching expenses"));
        }
        return await response.json();
    },

    createExpense: async (data: ExpensePayload): Promise<Expense> => {
        const response = await apiFetch("/api/v1/expenses/", {
            method: "POST",
            body: JSON.stringify(data),
        });
        if (!response.ok) {
            throw new Error(await extractErrorMessage(response, "Error creating expense"));
        }
        return await response.json();
    },

    updateExpense: async (id: number, data: Partial<ExpensePayload>): Promise<Expense> => {
        const response = await apiFetch(`/api/v1/expenses/${id}`, {
            method: "PATCH",
            body: JSON.stringify(data),
        });
        if (!response.ok) {
            throw new Error(await extractErrorMessage(response, "Error updating expense"));
        }
        return await response.json();
    },

    deleteExpense: async (id: number): Promise<void> => {
        const response = await apiFetch(`/api/v1/expenses/${id}`, {
            method: "DELETE",
        });
        if (!response.ok) {
            throw new Error(await extractErrorMessage(response, "Error deleting expense"));
        }
    },
};
