import { apiFetch, assertApiResponseOk } from "@/lib/api";
import type { Expense, ExpensePayload } from "@/types/expense";
import { collectPaginated } from "@/lib/pagination";

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
        await assertApiResponseOk(response, "Error fetching expenses");
        return await response.json();
    },

    getAllExpenses: async (filters: Omit<ExpenseFilters, "skip" | "limit"> = {}): Promise<Expense[]> => collectPaginated(
        (skip, limit) => ExpenseService.getExpenses({ ...filters, skip, limit }),
    ),

    createExpense: async (data: ExpensePayload): Promise<Expense> => {
        const response = await apiFetch("/api/v1/expenses/", {
            method: "POST",
            body: JSON.stringify(data),
        });
        await assertApiResponseOk(response, "Error creating expense");
        return await response.json();
    },

    updateExpense: async (id: number, data: Partial<ExpensePayload>): Promise<Expense> => {
        const response = await apiFetch(`/api/v1/expenses/${id}`, {
            method: "PATCH",
            body: JSON.stringify(data),
        });
        await assertApiResponseOk(response, "Error updating expense");
        return await response.json();
    },

    deleteExpense: async (id: number): Promise<void> => {
        const response = await apiFetch(`/api/v1/expenses/${id}`, {
            method: "DELETE",
        });
        await assertApiResponseOk(response, "Error deleting expense");
    },

    uploadReceipt: async (id: number, file: File): Promise<Expense> => {
        const body = new FormData();
        body.append("file", file);
        const response = await apiFetch(`/api/v1/expenses/${id}/receipt`, {
            method: "POST",
            body,
        });
        await assertApiResponseOk(response, "Error uploading receipt");
        return await response.json();
    },

    downloadReceipt: async (id: number): Promise<{ blob: Blob; filename: string }> => {
        const response = await apiFetch(`/api/v1/expenses/${id}/receipt`, {
            method: "GET",
            cache: "no-store",
        });
        await assertApiResponseOk(response, "Error downloading receipt");
        const filename = response.headers.get("Content-Disposition")?.match(/filename="([^"]+)"/)?.[1]
            ?? `justificante-${id}`;
        return { blob: await response.blob(), filename };
    },
};
