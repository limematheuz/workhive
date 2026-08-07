import { InvoiceDetailFiscalAside } from "@/components/invoices/InvoiceDetailFiscalPanel";
import { getInvoiceStatusMeta } from "@/components/invoices/invoice-detail-utils";
import type { DraftFiscalPreview } from "@/components/invoices/invoice-detail-document-types";
import type { Dictionary } from "@/lib/dictionary-context";
import { formatCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";
import type {
    FacturaeReadiness,
    FiscalInvoiceRecord,
    FiscalReadiness,
} from "@/services/invoice.service";
import type { Invoice } from "@/types/invoice";

type InvoiceDetailSummaryAsideProps = {
    dict: Dictionary;
    invoice: Invoice;
    noticeCount: number;
    draftFiscalPreview: DraftFiscalPreview | null;
    fiscalRecord: FiscalInvoiceRecord | null;
    fiscalReadiness: FiscalReadiness | null;
    facturaeReadiness: FacturaeReadiness | null;
    onSettingsChanged: () => Promise<void>;
};

export function InvoiceDetailSummaryAside({
    dict,
    invoice,
    noticeCount,
    draftFiscalPreview,
    fiscalRecord,
    fiscalReadiness,
    facturaeReadiness,
    onSettingsChanged,
}: InvoiceDetailSummaryAsideProps) {
    const invoiceStatusMeta = getInvoiceStatusMeta(invoice.status, dict);

    return (
        <aside className="relative z-10 hidden space-y-3 print:hidden xl:sticky xl:top-0 xl:block xl:self-start">
            <section className="billing-surface relative overflow-hidden rounded-[24px] p-4 pt-6">
                <div className="absolute left-4 right-4 top-3 h-1.5 rounded-full bg-accent" />
                <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                    {dict.invoices.dashboard_summary}
                </p>
                <div className="mt-3 space-y-3">
                    <div>
                        <p className="text-[10px] font-semibold uppercase text-[var(--text-muted)]">{dict.invoices.total_amount}</p>
                        <p className="mt-1 font-mono text-xl font-semibold text-[var(--text-main)]">
                            {formatCurrency(invoice.total_amount)}
                        </p>
                    </div>
                    <div className="grid grid-cols-1 gap-2 text-[11px] 2xl:grid-cols-2">
                        <div className="rounded-2xl bg-[var(--bg-tertiary)] p-3">
                            <p className="font-semibold uppercase text-[var(--text-muted)]">{dict.invoices.base_amount}</p>
                            <p className="mt-1 font-mono font-semibold text-[var(--text-main)]">{formatCurrency(invoice.base_amount)}</p>
                        </div>
                        <div className="rounded-2xl bg-[var(--bg-tertiary)] p-3">
                            <p className="font-semibold uppercase text-[var(--text-muted)]">{dict.invoices.tax}</p>
                            <p className="mt-1 font-mono font-semibold text-[var(--text-main)]">{formatCurrency(invoice.tax_amount)}</p>
                        </div>
                    </div>
                    <div className="rounded-2xl bg-[var(--bg-tertiary)] p-3">
                        <p className="text-[10px] font-semibold uppercase text-[var(--text-muted)]">{dict.invoices.payment_status}</p>
                        <span className={cn("mt-2 inline-flex rounded-full border px-3 py-1 text-[11px] font-semibold uppercase", invoiceStatusMeta.className)}>
                            {invoiceStatusMeta.label}
                        </span>
                    </div>
                </div>
            </section>

            <InvoiceDetailFiscalAside
                dict={dict}
                invoice={invoice}
                noticeCount={noticeCount}
                draftFiscalPreview={draftFiscalPreview}
                fiscalRecord={fiscalRecord}
                fiscalReadiness={fiscalReadiness}
                facturaeReadiness={facturaeReadiness}
                onSettingsChanged={onSettingsChanged}
            />
        </aside>
    );
}
