import type { InvoicePaymentMethod } from "@/types/invoice";

export const INVOICE_PAYMENT_METHODS: InvoicePaymentMethod[] = [
    "bank_transfer",
    "direct_debit",
    "card",
    "cash",
    "bizum",
    "other",
];

export function getInvoicePaymentMethodLabel(
    paymentMethod: InvoicePaymentMethod | null | undefined,
    labels: Record<string, string>,
): string {
    const normalized = paymentMethod || "bank_transfer";
    return labels[normalized] || labels.bank_transfer || "Bank transfer";
}
