import Image from "next/image";

import { resolveApiMediaUrl } from "@/lib/api";
import type { Dictionary } from "@/lib/dictionary-context";
import { formatInvoiceNumber } from "@/lib/format";
import type { Invoice } from "@/types/invoice";

type InvoiceDetailHeaderSectionProps = {
    dict: Dictionary;
    invoice: Invoice;
    formatDate: (value: string | null | undefined) => string;
    issuerName: string;
    issuerTaxId: string;
    issuerAddress: string;
    issuerEmail: string;
    issuerLogo: string;
    recipientName: string;
    recipientTaxId: string;
    recipientAddress: string;
    recipientPostalCode: string;
    recipientCity: string;
    recipientCountry: string;
};

export function InvoiceDetailHeaderSection({
    dict,
    invoice,
    formatDate,
    issuerName,
    issuerTaxId,
    issuerAddress,
    issuerEmail,
    issuerLogo,
    recipientName,
    recipientTaxId,
    recipientAddress,
    recipientPostalCode,
    recipientCity,
    recipientCountry,
}: InvoiceDetailHeaderSectionProps) {
    return (
        <div className="grid gap-3 border-b border-[var(--border-soft)] pb-4 pt-4 print:grid-cols-[0.95fr_1.2fr_0.85fr] print:border-neutral-200 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.12fr)_minmax(14rem,0.98fr)] lg:items-stretch">
            <div className="rounded-2xl border border-[var(--border-soft)] bg-[var(--bg-secondary)] p-3.5 print:border-neutral-200 print:bg-white">
                <div className="flex items-center gap-3">
                    {issuerLogo ? (
                        <Image
                            src={resolveApiMediaUrl(issuerLogo) || ""}
                            alt="Company Logo"
                            width={140}
                            height={40}
                            className="max-h-10 max-w-[140px] object-contain print:max-h-9"
                            unoptimized
                        />
                    ) : (
                        <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-[var(--border-soft)] bg-[var(--bg-card)] text-xs font-black text-[var(--text-main)] print:border-neutral-300 print:bg-white print:text-black">
                            {issuerName.substring(0, 2).toUpperCase()}
                        </div>
                    )}
                    <div className="min-w-0">
                        <p className="text-[10px] font-black uppercase tracking-wider text-[var(--text-muted)] print:text-neutral-500">
                            {dict.invoices.issuer}
                        </p>
                        <p className="truncate text-sm font-black text-[var(--text-main)] print:text-black">
                            {issuerName}
                        </p>
                    </div>
                </div>
                <div className="text-[10px] leading-4 text-[var(--text-muted)] print:text-neutral-600">
                    {invoice.custom_issuer_info ? (
                        <p className="whitespace-pre-line">{invoice.custom_issuer_info}</p>
                    ) : (
                        <div className="mt-2 grid gap-1">
                            <p><span className="font-semibold text-[var(--text-main)] print:text-black">{dict.invoices.tax_id}:</span> {issuerTaxId || "-"}</p>
                            <p>{issuerAddress || "-"}</p>
                            <p>{issuerEmail || "-"}</p>
                        </div>
                    )}
                </div>
            </div>

            <div className="rounded-2xl border border-[var(--border-soft)] bg-[var(--bg-secondary)] p-3.5 print:border-neutral-200 print:bg-neutral-50">
                <p className="text-[10px] font-black uppercase tracking-wider text-[var(--text-muted)] print:text-neutral-600">{dict.invoices.billed_to}</p>
                <h3 className="mt-1 truncate text-sm font-black leading-tight text-[var(--text-main)] print:text-black">{recipientName}</h3>
                <div className="mt-2 grid gap-1 text-[10px] leading-4 text-[var(--text-muted)] print:text-neutral-600">
                    {invoice.custom_recipient_info ? (
                        <p className="whitespace-pre-line">{invoice.custom_recipient_info}</p>
                    ) : (
                        <>
                            <p><span className="font-semibold text-[var(--text-main)] print:text-black">{dict.invoices.tax_id}:</span> {recipientTaxId || "-"}</p>
                            <p><span className="font-semibold text-[var(--text-main)] print:text-black">{dict.invoices.address}:</span> {recipientAddress || "-"}</p>
                            <p><span className="font-semibold text-[var(--text-main)] print:text-black">{dict.invoices.postal_city}:</span> {recipientPostalCode} {recipientCity}</p>
                            <p><span className="font-semibold text-[var(--text-main)] print:text-black">{dict.invoices.country}:</span> {recipientCountry || "-"}</p>
                        </>
                    )}
                </div>
            </div>

            <div className="rounded-2xl border border-[var(--border-soft)] bg-[var(--bg-secondary)] p-3.5 text-left print:border-neutral-200 print:bg-white lg:text-right">
                <p className="text-[10px] font-black uppercase tracking-wider text-[var(--text-muted)] print:text-neutral-600">
                    {invoice.status === "draft" ? dict.invoices.status_draft : dict.invoices.issued_document}
                </p>
                <h1 className="mt-1 break-all font-mono text-xl font-black leading-tight text-[var(--text-main)] print:text-black">
                    {formatInvoiceNumber(invoice.invoice_number)}
                </h1>
                <div className="mt-3 grid grid-cols-1 gap-2 text-left text-[10px] 2xl:grid-cols-2">
                    <div className="min-h-[4.75rem] rounded-xl bg-[var(--bg-card)] px-3.5 py-2.5 print:bg-white">
                        <span className="block text-[9px] font-black uppercase leading-4 text-[var(--text-muted)]">{dict.invoices.issue_date}</span>
                        <span className="mt-1 block font-mono font-black leading-5 text-[var(--text-main)] print:text-black">{formatDate(invoice.issue_date)}</span>
                    </div>
                    {invoice.due_date && (
                        <div className="min-h-[4.75rem] rounded-xl bg-[var(--bg-card)] px-3.5 py-2.5 print:bg-white">
                            <span className="block text-[9px] font-black uppercase leading-4 text-[var(--text-muted)]">{dict.invoices.due_date}</span>
                            <span className="mt-1 block font-mono font-black leading-5 text-[var(--text-main)] print:text-black">{formatDate(invoice.due_date)}</span>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
