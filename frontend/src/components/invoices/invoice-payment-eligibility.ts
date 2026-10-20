import type { Invoice } from "@/types/invoice";

const PAYABLE_INVOICE_STATUSES: ReadonlySet<Invoice["status"]> = new Set([
    "issued",
    "overdue",
    "partially_paid",
]);

export function getCollectibleRemaining(
    invoice: Pick<Invoice, "status" | "total_amount" | "is_rectification">,
    allocated: number,
): number {
    if (invoice.is_rectification || !PAYABLE_INVOICE_STATUSES.has(invoice.status)) return 0;
    return Math.max(0, Math.round((Number(invoice.total_amount) - allocated) * 100) / 100);
}

export function canOfferCustomerPayment(
    invoice: Pick<Invoice, "status" | "is_rectification">,
    canManage: boolean,
    remaining: number,
): boolean {
    return canManage && remaining > 0 && !invoice.is_rectification && PAYABLE_INVOICE_STATUSES.has(invoice.status);
}
