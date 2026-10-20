import type { Invoice } from "@/types/invoice";

const PAYABLE_INVOICE_STATUSES: ReadonlySet<Invoice["status"]> = new Set([
    "issued",
    "overdue",
    "partially_paid",
]);

export function canOfferCustomerPayment(
    invoice: Pick<Invoice, "status" | "is_rectification">,
    canManage: boolean,
    remaining: number,
): boolean {
    return canManage && remaining > 0 && !invoice.is_rectification && PAYABLE_INVOICE_STATUSES.has(invoice.status);
}
