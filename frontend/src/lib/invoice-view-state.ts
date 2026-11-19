import type { InvoiceAttention } from "./finance-workspace.ts";

export const INVOICE_VIEW_FILTER_KEYS = ["month", "client", "status", "search", "attention"] as const;
export function invoiceViewFilters(values: Record<string, string>): { month: string; client: string; status: string; search: string; attention: InvoiceAttention } {
    return {
        month: /^(\d{4})-(0[1-9]|1[0-2])$/.test(values.month ?? "") ? values.month : "",
        client: /^\d+$/.test(values.client ?? "") && Number.isSafeInteger(Number(values.client)) && Number(values.client) > 0 ? values.client : "",
        status: ["draft", "issued", "partially_paid", "paid", "overdue", "cancelled", "rectified"].includes(values.status) ? values.status : "",
        search: (values.search ?? "").slice(0, 250),
        attention: ["all", "draft", "pending", "overdue"].includes(values.attention) ? values.attention as InvoiceAttention : "all",
    };
}
