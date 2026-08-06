import type { Dictionary } from "@/lib/dictionary-context";

type InvoiceDetailShippingAddressProps = {
    dict: Dictionary;
    shippingAddress: string | null | undefined;
};

export function InvoiceDetailShippingAddress({ dict, shippingAddress }: InvoiceDetailShippingAddressProps) {
    if (!shippingAddress) {
        return null;
    }

    return (
        <div className="mt-4 rounded-2xl bg-[var(--bg-secondary)] p-4 text-xs text-[var(--text-muted)] print:bg-neutral-50 print:text-neutral-600">
            <span className="font-bold text-[var(--text-main)] print:text-black block mb-1">{dict.invoices.shipping_address}:</span>
            <div className="whitespace-pre-line">{shippingAddress}</div>
        </div>
    );
}
