import Link from "next/link";
import { AlertTriangle } from "lucide-react";

import type { Dictionary } from "@/lib/dictionary-context";
import type { Invoice } from "@/types/invoice";

type InvoiceDetailRectificationBannerProps = {
    dict: Dictionary;
    invoice: Invoice;
};

export function InvoiceDetailRectificationBanner({ dict, invoice }: InvoiceDetailRectificationBannerProps) {
    if (!invoice.is_rectification || !invoice.original_invoice_id) {
        return null;
    }

    return (
        <div className="mt-6 rounded-xl border border-[var(--btn-cancel-border)] bg-[var(--btn-cancel-bg)] p-4 flex items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2 text-[var(--btn-cancel-text)]">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>
                    <strong>{dict.invoices.rectification_badge}:</strong>{" "}
                    {dict.invoices.rectification_original_label}{" "}
                    <span className="font-mono font-semibold">#{invoice.original_invoice_id}</span>
                </span>
            </div>
            <Link
                href={`/dashboard/invoices/${invoice.original_invoice_id}`}
                className="flex items-center gap-1 text-accent hover:underline font-semibold no-underline shrink-0"
            >
                {dict.invoices.view_original}
            </Link>
        </div>
    );
}
