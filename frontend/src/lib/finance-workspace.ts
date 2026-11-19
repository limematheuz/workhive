import { financeLocalDay, invoiceOutstandingCents, isInvoiceOverdue } from "./finance-priorities.ts";

export type FinanceInvoice = {
    id: number; client_id: number; invoice_number: string; issue_date: string; due_date?: string | null;
    total_amount: number; collected_amount?: number; status: string; is_rectification: boolean;
};
export type FinancePayment = {
    id: number; client_id: number; received_at: string; amount: string; status: string;
    reference: string | null; allocations: Array<{ invoice_id: number; amount: string }>;
};
export type InvoiceAttention = "all" | "draft" | "pending" | "overdue";
export const BILLED_INVOICE_STATUSES = new Set(["issued", "partially_paid", "paid", "overdue", "rectified"]);

export function inFinanceMonth(value: string, month: string): boolean {
    return /^\d{4}-\d{2}$/.test(month) && value.slice(0, 7) === month;
}

/** All arithmetic is in cents; an absent or invalid amount is not a zero. */
export function financeCents(value: number | string | null | undefined): number | null {
    if (value === null || value === undefined || (typeof value === "string" && value.trim() === "")) return null;
    const amount = Number(value);
    return Number.isFinite(amount) ? Math.sign(amount) * Math.round((Math.abs(amount) + Number.EPSILON) * 100) : null;
}

export function selectInvoiceAttention<T extends FinanceInvoice>(invoices: T[], attention: InvoiceAttention, asOf: string): T[] {
    return invoices.filter((invoice) => attention === "all"
        || (attention === "draft" && invoice.status === "draft")
        || (attention === "pending" && invoiceOutstandingCents(invoice) > 0)
        || (attention === "overdue" && isInvoiceOverdue(invoice, asOf)));
}

export function selectPeriodPayments<T extends FinancePayment>(payments: T[], month: string): T[] {
    return payments.filter((payment) => payment.status === "received" && inFinanceMonth(payment.received_at, month));
}

export function paymentTotalCents(payments: FinancePayment[]): number | null {
    let total = 0;
    for (const payment of payments) {
        const cents = financeCents(payment.amount);
        if (cents === null) return null;
        total += cents;
    }
    return total;
}

/** Current-month comparisons use the same number of elapsed days in the previous month. */
export function comparableMonthDay(month: string, reference = new Date()): number | null {
    return month === financeLocalDay(reference).slice(0, 7) ? reference.getDate() : null;
}

export function throughComparableDay<T>(rows: T[], getDate: (row: T) => string, day: number | null): T[] {
    return day === null ? rows : rows.filter((row) => Number(getDate(row).slice(8, 10)) <= day);
}

export function financeChange(current: number, previous: number): { kind: "percent" | "absolute"; value: number } {
    return previous === 0 ? { kind: "absolute", value: current - previous }
        : { kind: "percent", value: ((current - previous) / Math.abs(previous)) * 100 };
}

export type AgingBucket = "current" | "1-30" | "31-60" | "61-90" | "90+" | "undated";
export function invoiceAgingBucket(invoice: FinanceInvoice, asOf: string): AgingBucket | null {
    if (invoiceOutstandingCents(invoice) <= 0) return null;
    const due = invoice.due_date?.slice(0, 10);
    if (!due || !/^\d{4}-\d{2}-\d{2}$/.test(due) || !Number.isFinite(Date.parse(due))) return "undated";
    if (due >= asOf) return "current";
    const days = Math.floor((Date.parse(asOf) - Date.parse(due)) / 86_400_000);
    return days <= 30 ? "1-30" : days <= 60 ? "31-60" : days <= 90 ? "61-90" : "90+";
}
