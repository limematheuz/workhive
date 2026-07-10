"use client";

import Link from "next/link";
import {
    ArrowLeft,
    Check,
    CloudUpload,
    Download,
    FileCode2,
    FileX2,
    Loader2,
    Mail,
    Pencil,
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
    onEnterEditMode: () => void;
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
    onEnterEditMode,
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
                <button
                    type="button"
                    key={state}
                    onClick={() => onStatusChange(state)}
                    disabled={updatingStatus}
                    className={cn(
                        "min-h-10 rounded-xl border px-3.5 text-center text-[12px] font-black leading-tight transition disabled:cursor-not-allowed disabled:opacity-70",
                        meta.className,
                    )}
                >
                    {updatingStatus ? <Loader2 className="mr-2 inline h-3.5 w-3.5 animate-spin" /> : null}
                    {meta.label}
                </button>
            );
        });

    const renderActionButtons = () => (
        <>
            {invoice.status === "draft" && !editMode && (
                <button
                    type="button"
                    onClick={onEnterEditMode}
                    className={cn(actionButtonClass("neutral"), "w-full sm:w-auto")}
                >
                    <Pencil className="h-4 w-4" />
                    {dict.invoices.edit_draft}
                </button>
            )}

            {editMode && (
                <>
                    <button
                        type="button"
                        onClick={onDiscardEdit}
                        disabled={savingDraft}
                        className={cn(actionButtonClass("neutral"), "w-full sm:w-auto")}
                    >
                        <X className="h-4 w-4" />
                        {dict.invoices.discard}
                    </button>
                    <button
                        type="button"
                        onClick={onSaveDraft}
                        disabled={savingDraft}
                        className={cn(actionButtonClass("primary"), "w-full sm:w-auto")}
                    >
                        {savingDraft ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                            <Check className="h-4 w-4" />
                        )}
                        {dict.invoices.save_changes}
                    </button>
                </>
            )}

            {!invoice.is_rectification && ["issued", "paid", "overdue"].includes(invoice.status) && (
                <button
                    type="button"
                    onClick={onOpenRectification}
                    className={cn(actionButtonClass("danger"), "w-full sm:w-auto")}
                >
                    <FileX2 className="h-4 w-4" />
                    {dict.invoices.create_rectification}
                </button>
            )}

            {["draft", "issued", "paid", "overdue", "rectified"].includes(invoice.status) && (
                <button
                    type="button"
                    onClick={onOpenEmailDialog}
                    disabled={sendingEmail}
                    className={cn(actionButtonClass("neutral"), "w-full sm:w-auto")}
                >
                    {sendingEmail ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                        <Mail className="h-4 w-4" />
                    )}
                    {invoice.status === "draft" ? dict.invoices.send_proforma : dict.invoices.send_email}
                </button>
            )}

            {fiscalRecord && !["accepted", "accepted_with_errors"].includes(fiscalRecord.submission_status) && (
                <button
                    type="button"
                    onClick={() => void onSubmitFiscal()}
                    disabled={submittingFiscal || !fiscalReadiness?.submission_available}
                    title={!fiscalReadiness?.submission_available ? dict.invoices.fiscal_not_configured : undefined}
                    className={cn(
                        actionButtonClass(!fiscalReadiness?.submission_available ? "disabled" : "neutral"),
                        "w-full sm:w-auto",
                    )}
                >
                    {submittingFiscal ? <Loader2 className="h-4 w-4 animate-spin" /> : <CloudUpload className="h-4 w-4" />}
                    {dict.invoices.submit_aeat}
                </button>
            )}

            {facturaeReadiness?.unsigned_generation_available && (
                <button
                    type="button"
                    onClick={() => void onFacturae(false)}
                    disabled={generatingFacturae}
                    className={cn(actionButtonClass("neutral"), "w-full sm:w-auto")}
                >
                    {generatingFacturae ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileCode2 className="h-4 w-4" />}
                    {dict.invoices.download_facturae}
                </button>
            )}

            {facturaeReadiness?.signed_generation_available && (
                <button
                    type="button"
                    onClick={() => void onFacturae(true)}
                    disabled={generatingFacturae}
                    className={cn(actionButtonClass("neutral"), "w-full sm:w-auto")}
                >
                    {generatingFacturae ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileCode2 className="h-4 w-4" />}
                    {dict.invoices.download_signed_facturae}
                </button>
            )}
        </>
    );

    return (
        <div className="mx-auto mb-3 w-full max-w-[112rem] rounded-[24px] border border-[var(--border-color)] bg-[var(--bg-card-solid)] p-3 print:hidden">
            <header className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
                <div className="flex min-w-0 gap-3">
                    <Link
                        href="/dashboard/invoices"
                        aria-label={dict.invoices.back_to_list}
                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-[var(--border-soft)] bg-[var(--bg-secondary)] text-[var(--text-main)] transition hover:border-[var(--btn-secondary-border)] hover:bg-[var(--bg-tertiary)]"
                    >
                        <ArrowLeft className="h-4 w-4" />
                    </Link>
                    <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                            <span className="text-sm font-black text-[var(--text-main)]">
                                {dict.invoices.title}
                            </span>
                            <span className={cn("rounded-full border px-2.5 py-1 text-[10px] font-black uppercase leading-none", invoiceStatusMeta.className)}>
                                {invoiceStatusMeta.label}
                            </span>
                            {invoice.is_rectification && (
                                <span className="rounded-full border border-[var(--btn-cancel-border)] bg-[var(--btn-cancel-bg)] px-2.5 py-1 text-[10px] font-black uppercase leading-none text-[var(--btn-cancel-text)]">
                                    {dict.invoices.rectification}
                                </span>
                            )}
                        </div>
                        <h1 className="mt-1 max-w-full text-[clamp(1.45rem,2.25vw,2.25rem)] font-black leading-none tracking-tight text-[var(--text-main)] [overflow-wrap:anywhere]">
                            {formattedInvoiceNumber}
                        </h1>
                    </div>
                </div>

                <button
                    type="button"
                    onClick={() => void onPdfAction()}
                    disabled={downloadingPdf}
                    className={cn(actionButtonClass("primary"), "w-full xl:w-auto xl:min-w-[13rem]")}
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
                </button>
            </header>

            <section className="mt-3 grid gap-2.5 md:grid-cols-2 xl:grid-cols-4">
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
                    <div key={card.label} className="min-w-0 rounded-2xl border border-[var(--border-soft)] bg-[var(--bg-secondary)] p-3">
                        <p className="truncate text-[11px] font-black uppercase tracking-wide text-[var(--text-muted)]">{card.label}</p>
                        <p className={cn("mt-2 truncate text-lg font-black text-[var(--text-main)]", card.mono && "font-mono")}>
                            {card.value}
                        </p>
                    </div>
                ))}
            </section>

            {(nextStates.length > 0 || actionButtonsVisible) && (
                <section className="mt-3 border-t border-[var(--border-soft)] pt-3">
                    <div className="flex flex-col gap-2 xl:flex-row xl:items-start xl:justify-between">
                        {nextStates.length > 0 && (
                            <div className="rounded-2xl border border-[var(--border-soft)] bg-[var(--bg-card)] p-2">
                                <p className="mb-2 px-1 text-[10px] font-black uppercase tracking-wide text-[var(--text-muted)]">
                                    {dict.invoices.change_status}
                                </p>
                                <div className="flex flex-wrap gap-2">
                                    {renderStatusButtons()}
                                </div>
                            </div>
                        )}
                        {actionButtonsVisible && (
                            <div className="flex flex-wrap gap-2 rounded-2xl border border-[var(--border-soft)] bg-[var(--bg-card)] p-2">
                                {renderActionButtons()}
                            </div>
                        )}
                    </div>
                </section>
            )}
        </div>
    );
}
