"use client";

import { AlertTriangle, Info, ShieldCheck } from "lucide-react";

import { FiscalSettingsPanel } from "@/components/invoices/FiscalSettingsPanel";
import { InvoiceNoticeCard } from "@/components/invoices/InvoiceNoticeCard";
import type { Dictionary } from "@/lib/dictionary-context";
import type {
    FacturaeReadiness,
    FiscalInvoiceRecord,
    FiscalReadiness,
} from "@/services/invoice.service";
import type { Invoice } from "@/types/invoice";

type DraftFiscalPreview = {
    code: string;
    title: string;
    description: string;
};

type InvoiceDetailFiscalPanelProps = {
    dict: Dictionary;
    invoice: Invoice;
    noticeCount: number;
    draftFiscalPreview: DraftFiscalPreview | null;
    fiscalRecord: FiscalInvoiceRecord | null;
    fiscalReadiness: FiscalReadiness | null;
    facturaeReadiness: FacturaeReadiness | null;
    onSettingsChanged: () => Promise<void>;
    placement?: "main" | "aside";
};

function InvoiceFiscalNoticeCards({
    dict,
    invoice,
    draftFiscalPreview,
    fiscalRecord,
    fiscalReadiness,
    facturaeReadiness,
}: Omit<InvoiceDetailFiscalPanelProps, "noticeCount" | "onSettingsChanged" | "placement">) {
    return (
        <>
            {draftFiscalPreview && (
                <InvoiceNoticeCard
                    icon={<AlertTriangle className="h-5 w-5" />}
                    title={draftFiscalPreview.title}
                    tone={draftFiscalPreview.code === "F2" ? "warning" : "success"}
                >
                    {draftFiscalPreview.description}
                </InvoiceNoticeCard>
            )}

            {invoice.status !== "draft" && (
                <InvoiceNoticeCard
                    icon={<Info className="h-5 w-5" />}
                    title={dict.invoices.immutable_invoice_title}
                >
                    {dict.invoices.cannot_edit_non_draft}
                </InvoiceNoticeCard>
            )}

            {invoice.invoice_hash && (
                <InvoiceNoticeCard
                    icon={<ShieldCheck className="h-5 w-5" />}
                    title={dict.invoices.integrity_record_generated}
                    tone="success"
                >
                    <div className="space-y-1">
                        <p>
                            {dict.invoices.fiscal_status}:{" "}
                            <span className="font-bold text-[var(--text-main)]">
                                {fiscalRecord?.submission_status || invoice.fiscal_submission_status}
                            </span>
                        </p>
                        <p className="font-mono text-[11px] [overflow-wrap:anywhere]">
                            SHA-256: {invoice.invoice_hash}
                        </p>
                        {fiscalRecord?.aeat_csv && (
                            <p className="font-mono text-[11px] [overflow-wrap:anywhere]">CSV AEAT: {fiscalRecord.aeat_csv}</p>
                        )}
                        {fiscalRecord?.error_message && (
                            <p className="font-bold text-[var(--btn-cancel-text)]">{fiscalRecord.error_message}</p>
                        )}
                        {!fiscalReadiness?.submission_available && (
                            <p>{dict.invoices.fiscal_not_configured}</p>
                        )}
                        {facturaeReadiness && facturaeReadiness.missing_fields.length > 0 && (
                            <p className="font-bold text-amber-600">
                                {dict.invoices.facturae_missing_fields}: {facturaeReadiness.missing_fields.join(", ")}
                            </p>
                        )}
                    </div>
                </InvoiceNoticeCard>
            )}
        </>
    );
}

export function InvoiceDetailFiscalPanel({
    dict,
    invoice,
    noticeCount,
    draftFiscalPreview,
    fiscalRecord,
    fiscalReadiness,
    facturaeReadiness,
    onSettingsChanged,
    placement = "main",
}: InvoiceDetailFiscalPanelProps) {
    if (placement === "aside") {
        return (
            <>
                {(invoice.invoice_hash || fiscalRecord || facturaeReadiness) && (
                    <section className="rounded-[22px] bg-[var(--bg-tertiary)] p-4 text-xs leading-5">
                        <p className="text-[10px] font-black uppercase tracking-wide text-[var(--text-muted)]">
                            {dict.invoices.fiscal_summary}
                        </p>
                        <div className="mt-3 space-y-2 text-[var(--text-muted)]">
                            <p>
                                {dict.invoices.fiscal_status}:{" "}
                                <span className="font-black text-[var(--text-main)]">
                                    {fiscalRecord?.submission_status || invoice.fiscal_submission_status || "-"}
                                </span>
                            </p>
                            {invoice.invoice_hash && (
                                <p className="font-mono text-[10px] [overflow-wrap:anywhere]">
                                    SHA-256: {invoice.invoice_hash.slice(0, 22)}...
                                </p>
                            )}
                            {facturaeReadiness && facturaeReadiness.missing_fields.length > 0 && (
                                <p className="font-bold text-[var(--alert-warning-text)]">
                                    {dict.invoices.facturae_missing_fields}: {facturaeReadiness.missing_fields.length}
                                </p>
                            )}
                        </div>
                    </section>
                )}

                {noticeCount > 0 && (
                    <div className="space-y-3">
                        <InvoiceFiscalNoticeCards
                            dict={dict}
                            invoice={invoice}
                            draftFiscalPreview={draftFiscalPreview}
                            fiscalRecord={fiscalRecord}
                            fiscalReadiness={fiscalReadiness}
                            facturaeReadiness={facturaeReadiness}
                        />
                    </div>
                )}
            </>
        );
    }

    return (
        <>
            {noticeCount > 0 && (
                <>
                    <details className="mx-auto mb-3 w-full max-w-[112rem] rounded-2xl bg-[var(--bg-tertiary)] p-3 print:hidden md:hidden">
                        <summary className="flex cursor-pointer list-none items-center justify-between text-[12px] font-black text-[var(--text-main)]">
                            {dict.invoices.invoice_notices}
                            <span className="rounded-full bg-[var(--bg-tertiary)] px-2 py-1 text-[10px] text-[var(--text-muted)]">
                                {noticeCount}
                            </span>
                        </summary>
                        <div className="mt-3 grid gap-2">
                            <InvoiceFiscalNoticeCards
                                dict={dict}
                                invoice={invoice}
                                draftFiscalPreview={draftFiscalPreview}
                                fiscalRecord={fiscalRecord}
                                fiscalReadiness={fiscalReadiness}
                                facturaeReadiness={facturaeReadiness}
                            />
                        </div>
                    </details>

                    <div className="mx-auto mb-4 hidden w-full max-w-[112rem] gap-3 md:grid lg:grid-cols-2 xl:hidden">
                        <InvoiceFiscalNoticeCards
                            dict={dict}
                            invoice={invoice}
                            draftFiscalPreview={draftFiscalPreview}
                            fiscalRecord={fiscalRecord}
                            fiscalReadiness={fiscalReadiness}
                            facturaeReadiness={facturaeReadiness}
                        />
                    </div>
                </>
            )}

            {invoice.invoice_hash && (
                <FiscalSettingsPanel onSettingsChanged={onSettingsChanged} />
            )}
        </>
    );
}

export function InvoiceDetailFiscalAside({
    dict,
    invoice,
    noticeCount,
    draftFiscalPreview,
    fiscalRecord,
    fiscalReadiness,
    facturaeReadiness,
    onSettingsChanged,
}: Omit<InvoiceDetailFiscalPanelProps, "placement">) {
    return (
        <InvoiceDetailFiscalPanel
            dict={dict}
            invoice={invoice}
            noticeCount={noticeCount}
            draftFiscalPreview={draftFiscalPreview}
            fiscalRecord={fiscalRecord}
            fiscalReadiness={fiscalReadiness}
            facturaeReadiness={facturaeReadiness}
            onSettingsChanged={onSettingsChanged}
            placement="aside"
        />
    );
}
