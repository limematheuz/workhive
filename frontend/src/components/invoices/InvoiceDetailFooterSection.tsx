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
    const issuerSnapshot = invoice.issuer_snapshot || {};
    const bankAccount = String(issuerSnapshot.bank_account || company?.bank_account || "");
    const swiftBic = String(issuerSnapshot.swift_bic || company?.swift_bic || "");

    if (!invoice.notes && !invoice.terms && !invoice.signature_url && !bankAccount && !swiftBic) {
        return null;
    }

    return (
        <section className="mt-6 space-y-4 pt-5">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                {invoice.notes && (
                    <section className="rounded-2xl bg-[var(--bg-tertiary)] p-3.5 text-2xs text-[var(--text-muted)] print:bg-white print:text-neutral-600">
                        <p className="text-3xs font-semibold uppercase tracking-wider text-[var(--text-main)] print:text-black">{dict.invoices.payment_notes}</p>
                        <p className="mt-2 whitespace-pre-line leading-5">{invoice.notes}</p>
                    </section>
                )}

                {invoice.terms && (
                    <section className="rounded-2xl bg-[var(--bg-tertiary)] p-3.5 text-2xs text-[var(--text-muted)] print:bg-white print:text-neutral-600">
                        <p className="text-3xs font-semibold uppercase tracking-wider text-[var(--text-main)] print:text-black">{dict.invoices.payment_terms}</p>
                        <p className="mt-2 whitespace-pre-line leading-5">{invoice.terms}</p>
                    </section>
                )}
            </div>

            <div className="flex flex-col gap-4 pt-1 md:flex-row md:items-end md:justify-between">
                {(bankAccount || swiftBic) && (
                    <div className="text-[10px] text-[var(--text-muted)] print:text-neutral-600">
                        <p className="font-semibold text-[var(--text-main)] print:text-black">{dict.invoices.payment_info}:</p>
                        {bankAccount && <p>{dict.invoices.bank_transfer}: <span className="font-mono font-semibold text-[var(--text-main)] print:text-black">{bankAccount}</span></p>}
                        {swiftBic && <p>SWIFT/BIC: <span className="font-mono font-semibold text-[var(--text-main)] print:text-black">{swiftBic}</span></p>}
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
                            className="max-h-16 rounded bg-[var(--bg-secondary)] p-1 object-contain"
                            unoptimized
                        />
                    </div>
                )}
            </div>
        </section>
    );
}
