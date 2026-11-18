type InvoiceBalance = { total_amount: number; collected_amount?: number; status: string; due_date?: string | null; is_rectification: boolean };

export function invoiceOutstandingCents(invoice: InvoiceBalance): number {
    if (invoice.is_rectification || !["issued", "partially_paid", "overdue"].includes(invoice.status)) return 0;
    const total = Number(invoice.total_amount), collected = Number(invoice.collected_amount ?? 0);
    return Number.isFinite(total) && Number.isFinite(collected) ? Math.max(0, Math.round(total * 100) - Math.round(collected * 100)) : 0;
}

export function isInvoiceOverdue(invoice: InvoiceBalance, today: string): boolean {
    const due = invoice.due_date?.slice(0, 10);
    return invoiceOutstandingCents(invoice) > 0 && (invoice.status === "overdue" || Boolean(due && /^\d{4}-\d{2}-\d{2}$/.test(due) && due < today));
}

export function financeLocalDay(date: Date): string {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
