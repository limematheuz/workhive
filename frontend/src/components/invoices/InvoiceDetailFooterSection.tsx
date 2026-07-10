import Image from "next/image";

import { resolveApiMediaUrl } from "@/lib/api";
import type { Dictionary } from "@/lib/dictionary-context";
import type { Company } from "@/services/company.service";
import type { Invoice } from "@/types/invoice";

type InvoiceDetailFooterSectionProps = {
    dict: Dictionary;
    invoice: Invoice;
    company: Company | null;
};

export function InvoiceDetailFooterSection({ dict, invoice, company }: InvoiceDetailFooterSectionProps) {
    if (!invoice.notes && !invoice.terms && !invoice.signature_url && !company?.bank_account) {
        return null;
    }

    return (
        <div className="mt-8 space-y-5 border-t border-dashed border-[var(--border-soft)] pt-5 print:border-neutral-300">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {invoice.notes && (
                    <div className="space-y-1 text-2xs text-[var(--text-muted)] print:text-neutral-600">
                        <p className="font-semibold text-[var(--text-main)] print:text-black uppercase tracking-wider text-3xs">{dict.invoices.payment_notes}</p>
                        <p className="whitespace-pre-line">{invoice.notes}</p>
                    </div>
                )}

                {invoice.terms && (
                    <div className="space-y-1 text-2xs text-[var(--text-muted)] print:text-neutral-600">
                        <p className="font-semibold text-[var(--text-main)] print:text-black uppercase tracking-wider text-3xs">{dict.invoices.payment_terms}</p>
                        <p className="whitespace-pre-line">{invoice.terms}</p>
                    </div>
                )}
            </div>

            <div className="flex flex-col md:flex-row md:justify-between md:items-end gap-4 pt-4 border-t border-[var(--border-soft)] border-dotted print:border-neutral-200">
                {company?.bank_account && (
                    <div className="text-[10px] text-[var(--text-muted)] print:text-neutral-600">
                        <p className="font-semibold text-[var(--text-main)] print:text-black">{dict.invoices.payment_info}:</p>
                        <p>{dict.invoices.bank_transfer}: <span className="font-mono font-semibold text-[var(--text-main)] print:text-black">{company.bank_account}</span></p>
                    </div>
                )}
                {invoice.signature_url && (
                    <div className="flex flex-col items-center md:items-end shrink-0 ml-auto">
                        <span className="text-[9px] uppercase tracking-wider font-bold text-[var(--text-muted)] print:text-neutral-500 mb-1">{dict.invoices.issuer_signature}</span>
                        <Image
                            src={resolveApiMediaUrl(invoice.signature_url) || ""}
                            alt="Firma"
                            width={160}
                            height={64}
                            className="max-h-16 object-contain border border-[var(--border-soft)] rounded p-1 print:border-neutral-300"
                            unoptimized
                        />
                    </div>
                )}
            </div>
        </div>
    );
}
