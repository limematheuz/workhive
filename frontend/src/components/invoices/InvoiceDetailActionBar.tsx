"use client";

import {
    Check,
    CloudUpload,
    Download,
    FileCode2,
    FileX2,
    Loader2,
    Mail,
    Printer,
    X,
} from "lucide-react";

import type { Dictionary } from "@/lib/dictionary-context";
import { formatCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";
import type {
    FacturaeReadiness,
    FiscalInvoiceRecord,
    FiscalReadiness,
} from "@/services/invoice.service";
import type { Invoice } from "@/types/invoice";

import {
    actionButtonClass,
    getInvoiceStatusMeta,
    statusActionMeta,
} from "@/components/invoices/invoice-detail-utils";
import { Button } from "@/components/ui/button";

type InvoiceDetailActionBarProps = {
    dict: Dictionary;
    invoice: Invoice;
    formattedInvoiceNumber: string;
    recipientName: string;
    formatDate: (value: string | null | undefined) => string;
    nextStates: string[];
    actionButtonsVisible: boolean;
    updatingStatus: boolean;
    downloadingPdf: boolean;
    editMode: boolean;
    savingDraft: boolean;
    sendingEmail: boolean;
    submittingFiscal: boolean;
    generatingFacturae: boolean;
    fiscalRecord: FiscalInvoiceRecord | null;
    fiscalReadiness: FiscalReadiness | null;
    facturaeReadiness: FacturaeReadiness | null;
    onPdfAction: () => void;
    onStatusChange: (state: string) => void;
    onDiscardEdit: () => void;
    onSaveDraft: () => void;
    onOpenRectification: () => void;
    onOpenEmailDialog: () => void;
    onSubmitFiscal: () => void;
    onFacturae: (signed: boolean) => void;
};

export function InvoiceDetailActionBar({
    dict,
    invoice,
    formattedInvoiceNumber,
    recipientName,
    formatDate,
    nextStates,
    actionButtonsVisible,
    updatingStatus,
    downloadingPdf,
    editMode,
    savingDraft,
    sendingEmail,
    submittingFiscal,
    generatingFacturae,
    fiscalRecord,
    fiscalReadiness,
    facturaeReadiness,
    onPdfAction,
    onStatusChange,
    onDiscardEdit,
    onSaveDraft,
    onOpenRectification,
    onOpenEmailDialog,
    onSubmitFiscal,
    onFacturae,
}: InvoiceDetailActionBarProps) {
    const invoiceStatusMeta = getInvoiceStatusMeta(invoice.status, dict);

    const renderStatusButtons = () =>
        nextStates.map((state) => {
            const meta = statusActionMeta(state, dict);
            return (
                <Button
                    type="button"
                    key={state}
                    onClick={() => onStatusChange(state)}
                    disabled={updatingStatus}
                    variant="ghost"
                    size="sm"
                    className={cn(
                        "min-h-10 rounded-xl border px-3.5 text-center text-[12px] font-semibold leading-tight transition hover:translate-y-0 hover:shadow-none disabled:cursor-not-allowed disabled:opacity-70",
                        meta.className,
                    )}
                >
                    {updatingStatus ? <Loader2 className="mr-2 inline h-3.5 w-3.5 animate-spin" /> : null}
                    {meta.label}
                </Button>
            );
        });

    const renderActionButtons = () => (
        <>
            {editMode && (
                <>
                    <Button
                        type="button"
                        onClick={onDiscardEdit}
                        disabled={savingDraft}
                        variant="secondary"
                        className={cn(actionButtonClass("secondary"), "w-full hover:translate-y-0 hover:shadow-none sm:w-auto")}
                    >
                        <X className="h-4 w-4" />
                        {dict.invoices.discard}
                    </Button>
                    <Button
                        type="button"
                        onClick={onSaveDraft}
                        disabled={savingDraft}
                        className={cn(actionButtonClass("primary"), "w-full hover:translate-y-0 hover:shadow-none sm:w-auto")}
                    >
                        {savingDraft ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                            <Check className="h-4 w-4" />
                        )}
                        {dict.invoices.save_changes}
                    </Button>
                </>
            )}

            {!invoice.is_rectification && ["issued", "partially_paid", "paid", "overdue"].includes(invoice.status) && (
                <Button
                    type="button"
                    onClick={onOpenRectification}
                    className={cn(actionButtonClass("primary"), "w-full hover:translate-y-0 hover:shadow-none sm:w-auto")}
                >
                    <FileX2 className="h-4 w-4" />
                    {dict.invoices.create_rectification}
                </Button>
            )}

            {["draft", "issued", "partially_paid", "paid", "overdue", "rectified"].includes(invoice.status) && (
                <Button
                    type="button"
                    onClick={onOpenEmailDialog}
                    disabled={sendingEmail}
                    variant={invoice.status === "draft" ? "select" : "outline"}
                    className={cn(
                        actionButtonClass(invoice.status === "draft" ? "select" : "neutral"),
                        "w-full hover:translate-y-0 hover:shadow-none sm:w-auto",
                    )}
                >
                    {sendingEmail ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                        <Mail className="h-4 w-4" />
                    )}
                    {invoice.status === "draft" ? dict.invoices.send_proforma : dict.invoices.send_email}
                </Button>
            )}

            {fiscalRecord && !["accepted", "accepted_with_errors"].includes(fiscalRecord.submission_status) && (
                <Button
                    type="button"
                    onClick={() => void onSubmitFiscal()}
                    disabled={submittingFiscal || !fiscalReadiness?.submission_available}
                    title={!fiscalReadiness?.submission_available ? dict.invoices.fiscal_not_configured : undefined}
                    variant="outline"
                    className={cn(
                        actionButtonClass(!fiscalReadiness?.submission_available ? "disabled" : "neutral"),
                        "w-full hover:translate-y-0 hover:shadow-none sm:w-auto",
                    )}
                >
                    {submittingFiscal ? <Loader2 className="h-4 w-4 animate-spin" /> : <CloudUpload className="h-4 w-4" />}
                    {dict.invoices.submit_aeat}
                </Button>
            )}

            {facturaeReadiness?.unsigned_generation_available && (
                <Button
                    type="button"
                    onClick={() => void onFacturae(false)}
                    disabled={generatingFacturae}
                    variant="outline"
                    className={cn(actionButtonClass("neutral"), "w-full hover:translate-y-0 hover:shadow-none sm:w-auto")}
                >
                    {generatingFacturae ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileCode2 className="h-4 w-4" />}
                    {dict.invoices.download_facturae}
                </Button>
            )}

            {facturaeReadiness?.signed_generation_available && (
                <Button
                    type="button"
                    onClick={() => void onFacturae(true)}
                    disabled={generatingFacturae}
                    variant="outline"
                    className={cn(actionButtonClass("neutral"), "w-full hover:translate-y-0 hover:shadow-none sm:w-auto")}
                >
                    {generatingFacturae ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileCode2 className="h-4 w-4" />}
                    {dict.invoices.download_signed_facturae}
                </Button>
            )}
        </>
    );

    return (
        <section className="billing-surface mx-auto mb-3 w-full max-w-[112rem] rounded-[24px] p-4 print:hidden sm:p-5">
            <header className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs font-semibold uppercase tracking-[0.1em] text-[var(--text-muted)]">
                            {dict.invoices.title}
                        </span>
                        <span className={cn("rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase leading-none", invoiceStatusMeta.className)}>
                            {invoiceStatusMeta.label}
                        </span>
                        {invoice.is_rectification && (
                            <span className="rounded-full border border-[var(--btn-cancel-border)] bg-[var(--btn-cancel-bg)] px-2.5 py-1 text-[10px] font-semibold uppercase leading-none text-[var(--btn-cancel-text)]">
                                {dict.invoices.rectification}
                            </span>
                        )}
                    </div>
                    <h1 className="mt-1 max-w-full text-[clamp(1.35rem,1.8vw,1.9rem)] font-bold leading-none tracking-tight text-[var(--text-main)] [overflow-wrap:anywhere]">
                        {formattedInvoiceNumber}
                    </h1>
                </div>

                <Button
                    type="button"
                    onClick={() => void onPdfAction()}
                    disabled={downloadingPdf}
                    className={cn(actionButtonClass("primary"), "w-full hover:translate-y-0 hover:shadow-none xl:w-auto xl:min-w-[13rem]")}
                >
                    {downloadingPdf ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                    ) : invoice.status === "draft" ? (
                        <Printer className="h-4 w-4" />
                    ) : (
                        <Download className="h-4 w-4" />
                    )}
                    {invoice.status === "draft"
                        ? dict.invoices.print_pdf
                        : dict.invoices.download_final_pdf}
                </Button>
            </header>

            <section className="mt-4 grid gap-2 md:grid-cols-2 xl:grid-cols-4">
                {[
                    { label: dict.invoices.total_amount, value: formatCurrency(invoice.total_amount), mono: true },
                    { label: dict.invoices.client, value: recipientName, mono: false },
                    { label: dict.invoices.issue_date, value: formatDate(invoice.issue_date), mono: true },
                    {
                        label: invoice.due_date ? dict.invoices.due_date : dict.invoices.status,
                        value: invoice.due_date ? formatDate(invoice.due_date) : invoiceStatusMeta.label,
                        mono: true,
                    },
                ].map((card) => (
                    <div key={card.label} className="min-w-0 rounded-xl bg-[var(--bg-tertiary)] px-3 py-2.5">
                        <p className="truncate text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--text-muted)]">{card.label}</p>
                        <p className={cn("mt-1.5 truncate text-base font-semibold text-[var(--text-main)]", card.mono && "font-mono")}>
                            {card.value}
                        </p>
                    </div>
                ))}
            </section>

            {(nextStates.length > 0 || actionButtonsVisible) && (
                <section className="mt-4 pt-4">
                    <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                        {nextStates.length > 0 && (
                            <div className="flex flex-wrap items-center gap-2">
                                <p className="mr-1 text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--text-muted)]">
                                    {dict.invoices.change_status}
                                </p>
                                {renderStatusButtons()}
                            </div>
                        )}
                        {actionButtonsVisible && (
                            <div className="flex flex-wrap gap-2 xl:justify-end">
                                {renderActionButtons()}
                            </div>
                        )}
                    </div>
                </section>
            )}
        </section>
    );
}
