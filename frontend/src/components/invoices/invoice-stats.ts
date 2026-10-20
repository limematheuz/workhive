import type { Invoice } from "@/types/invoice";

const BILLED_STATUSES: ReadonlySet<Invoice["status"]> = new Set([
    "issued", "partially_paid", "paid", "overdue", "rectified",
]);
const OPEN_STATUSES: ReadonlySet<Invoice["status"]> = new Set([
    "issued", "partially_paid", "overdue",
]);

const isOpenInvoice = (invoice: Invoice) => !invoice.is_rectification && OPEN_STATUSES.has(invoice.status);
const outstanding = (invoice: Invoice) => Math.max(0, Math.round((invoice.total_amount - (invoice.collected_amount ?? 0)) * 100) / 100);

export const countOpenInvoices = (invoices: Invoice[]) => invoices.filter(isOpenInvoice).length;

export const computeInvoiceStats = (invoices: Invoice[]) => ({
    totalCount: invoices.filter((invoice) => BILLED_STATUSES.has(invoice.status)).length,
    totalAmount: invoices
        .filter((invoice) => BILLED_STATUSES.has(invoice.status))
        .reduce((sum, invoice) => sum + invoice.total_amount, 0),
    paidAmount: invoices
        .filter((invoice) => BILLED_STATUSES.has(invoice.status) && !invoice.is_rectification)
        .reduce((sum, invoice) => sum + (invoice.collected_amount ?? 0), 0),
    openCount: countOpenInvoices(invoices),
    openAmount: invoices.filter(isOpenInvoice).reduce((sum, invoice) => sum + outstanding(invoice), 0),
    overdueAmount: invoices
        .filter((invoice) => invoice.status === "overdue" && !invoice.is_rectification)
        .reduce((sum, invoice) => sum + outstanding(invoice), 0),
});
