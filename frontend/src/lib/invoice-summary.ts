import type { Invoice, InvoicePaymentMethod } from "@/types/invoice";

export const REPORTABLE_INVOICE_STATUSES = new Set<Invoice["status"]>([
    "issued",
    "paid",
    "overdue",
    "rectified",
]);

export type InvoiceSummaryRow = {
    invoice: Invoice;
    clientName: string;
    concept: string;
    paymentMethod: InvoicePaymentMethod | null;
    paymentAccount: string;
};

export type InvoiceSummaryTotals = {
    base: number;
    tax: number;
    total: number;
    paid: number;
    pending: number;
};

function snapshotText(snapshot: Record<string, unknown> | null | undefined, key: string): string {
    const value = snapshot?.[key];
    return typeof value === "string" ? value.trim() : "";
}

function finiteAmount(value: number): number {
    return Number.isFinite(value) ? value : 0;
}

export function getInvoiceIssueYear(issueDate: string): string {
    const match = /^(\d{4})-\d{2}-\d{2}/.exec(issueDate);
    return match?.[1] ?? "";
}

export function buildInvoiceSummaryRows(
    invoices: Invoice[],
    clientNames: ReadonlyMap<number, string>,
): InvoiceSummaryRow[] {
    return invoices.flatMap((invoice) => {
        if (!REPORTABLE_INVOICE_STATUSES.has(invoice.status)) return [];

        return [{
            invoice,
            clientName: snapshotText(invoice.recipient_snapshot, "name")
                || clientNames.get(invoice.client_id)
                || `Cliente #${invoice.client_id}`,
            concept: invoice.items.flatMap((item) => {
                const description = item.description.trim();
                return description ? [description] : [];
            }).join(" · "),
            paymentMethod: invoice.payment_method || null,
            paymentAccount: snapshotText(invoice.issuer_snapshot, "bank_account"),
        }];
    });
}

export function filterInvoiceSummaryRows(
    rows: InvoiceSummaryRow[],
    filters: { year: string; search: string },
): InvoiceSummaryRow[] {
    const search = filters.search.trim().toLocaleLowerCase();
    return rows.filter((row) => {
        const year = getInvoiceIssueYear(row.invoice.issue_date);
        if (filters.year && year !== filters.year) return false;
        if (!search) return true;
        return [row.invoice.invoice_number, row.clientName, row.concept]
            .join(" ")
            .toLocaleLowerCase()
            .includes(search);
    });
}

export function summarizeInvoiceSummaryRows(rows: InvoiceSummaryRow[]): InvoiceSummaryTotals {
    return rows.reduce<InvoiceSummaryTotals>((totals, row) => {
        const { invoice } = row;
        if (!REPORTABLE_INVOICE_STATUSES.has(invoice.status)) return totals;
        const total = finiteAmount(invoice.total_amount);
        totals.base += finiteAmount(invoice.base_amount);
        totals.tax += finiteAmount(invoice.tax_amount);
        totals.total += total;
        if (invoice.status === "paid") totals.paid += total;
        else totals.pending += total;
        return totals;
    }, { base: 0, tax: 0, total: 0, paid: 0, pending: 0 });
}
