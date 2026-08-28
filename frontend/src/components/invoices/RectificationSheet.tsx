"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "@/lib/toast";
import { AlertTriangle, Loader2, FileX2 } from "lucide-react";
import { Invoice } from "@/types/invoice";
import { InvoiceService, RectificationCreate } from "@/services/invoice.service";
import { useDictionary } from "@/lib/dictionary-context";
import { formatCurrency, formatInvoiceNumber } from "@/lib/format";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { getErrorMessage } from "@/lib/errors";

interface RectificationModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    invoice: Invoice;
    onRectificationCreated?: () => void;
}

export function RectificationModal({
    open,
    onOpenChange,
    invoice,
    onRectificationCreated,
}: RectificationModalProps) {
    const { dict } = useDictionary();
    const router = useRouter();

    const today = new Date().toISOString().split("T")[0];
    const [reason, setReason] = useState("");
    const [reasonCode, setReasonCode] = useState("10");
    const [issueDate, setIssueDate] = useState(today);
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!reason.trim()) {
            toast.error(dict.invoices.rectification_reason_hint);
            return;
        }
        try {
            setLoading(true);
            const payload: RectificationCreate = {
                reason: reason.trim(),
                reason_code: reasonCode,
                issue_date: new Date(issueDate + "T12:00:00").toISOString(),
            };
            const newInvoice = await InvoiceService.rectifyInvoice(invoice.id, payload);
            toast.success(dict.invoices.rectification_success);
            onOpenChange(false);
            onRectificationCreated?.();
            router.push(`/dashboard/invoices/${newInvoice.id}`);
        } catch (error: unknown) {
            toast.error(getErrorMessage(error, dict.invoices.rectification_error));
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={(o) => !loading && onOpenChange(o)}>
            <DialogContent className="w-[95vw] sm:max-w-lg p-0 overflow-hidden border-[var(--border-soft)]">
                {/* Header */}
                <DialogHeader className="p-6 border-b border-[var(--border-soft)] text-left sm:text-left">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-soft)] flex items-center justify-center shrink-0">
                            <FileX2 className="w-4 h-4 text-[var(--text-muted)]" />
                        </div>
                        <div>
                            <span className="text-2xs uppercase font-black text-[var(--text-muted)] tracking-wider block">
                                {dict.invoices.rectification}
                            </span>
                            <DialogTitle className="text-base font-black text-[var(--text-main)] mt-0.5">
                                {dict.invoices.rectification_sheet_title}
                            </DialogTitle>
                        </div>
                    </div>
                    <DialogDescription className="text-xs text-[var(--text-muted)] mt-2 leading-relaxed">
                        {dict.invoices.rectification_sheet_subtitle}
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="p-6 space-y-5 overflow-y-auto max-h-[70vh]">
                    {/* Original invoice information */}
                    <div className="bg-[var(--bg-secondary)] border border-[var(--border-soft)] rounded-xl p-4 flex items-center justify-between gap-4">
                        <div>
                            <p className="text-2xs uppercase font-bold tracking-wider text-[var(--text-muted)]">
                                {dict.invoices.rectification_original_label}
                            </p>
                            <p className="text-sm font-mono font-black text-[var(--text-main)] mt-0.5">
                                {formatInvoiceNumber(invoice.invoice_number)}
                            </p>
                        </div>
                        <p className="text-sm font-bold text-[var(--text-main)] shrink-0">
                            {formatCurrency(invoice.total_amount)}
                        </p>
                    </div>

                    {/* Reason, required by law */}
                    <div className="space-y-1.5">
                        <Label htmlFor="rectification-reason-code" className="text-2xs uppercase font-bold text-[var(--text-muted)]">
                            {dict.invoices.rectification_reason_code_label}
                        </Label>
                        <Select
                            value={reasonCode}
                            onValueChange={setReasonCode}
                        >
                            <SelectTrigger id="rectification-reason-code" aria-label={dict.invoices.rectification_reason_code_label} className="h-11 w-full text-xs">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {Object.entries(dict.rectification_reason_codes).map(([code, label]) => (
                                    <SelectItem key={code} value={code}>{code} · {label}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-1.5">
                        <Label htmlFor="rectification-reason" className="text-2xs uppercase font-bold text-[var(--text-muted)]">
                            {dict.invoices.rectification_reason_label}
                        </Label>
                        <Textarea
                            id="rectification-reason"
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                            placeholder={dict.invoices.rectification_reason_placeholder}
                            rows={3}
                            required
                            className="w-full resize-none text-xs"
                        />
                        <p className="text-2xs text-[var(--text-muted)] flex items-center gap-1.5">
                            <AlertTriangle className="w-3 h-3 shrink-0" />
                            {dict.invoices.rectification_reason_hint}
                        </p>
                    </div>

                    {/* Issue date */}
                    <div className="space-y-1.5">
                        <Label htmlFor="rectification-issue-date" className="text-2xs uppercase font-bold text-[var(--text-muted)]">
                            {dict.invoices.rectification_issue_date_label}
                        </Label>
                        <DatePicker
                            id="rectification-issue-date"
                            value={issueDate}
                            onValueChange={setIssueDate}
                            required
                            aria-label={dict.invoices.rectification_issue_date_label}
                            className="w-full text-xs"
                        />
                    </div>

                    {/* Preview concepts as negative amounts */}
                    <div className="space-y-1.5">
                        <p className="text-2xs uppercase font-bold tracking-wider text-[var(--text-muted)]">
                            {dict.invoices.rectification_preview_title}
                        </p>
                        <div className="bg-[var(--bg-secondary)] border border-[var(--border-soft)] rounded-xl overflow-hidden">
                            {invoice.items && invoice.items.length > 0 ? (
                                <div className="divide-y divide-[var(--border-soft)]">
                                    {invoice.items.map((item) => (
                                        <div key={item.id} className="flex items-center justify-between gap-3 px-3 py-2.5">
                                            <span className="text-xs text-[var(--text-muted)] flex-1 truncate">
                                                {item.description}
                                            </span>
                                            <span className="text-xs font-bold text-[var(--text-main)] shrink-0 font-mono">
                                                -{formatCurrency(item.subtotal)}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-xs text-[var(--text-muted)] p-4 text-center">—</p>
                            )}
                            <div className="flex items-center justify-between px-3 py-2.5 border-t border-[var(--border-soft)] bg-[var(--bg-primary)]">
                                <span className="text-xs font-bold text-[var(--text-main)]">
                                    {dict.invoices.total_amount}
                                </span>
                                <span className="text-sm font-black font-mono text-[var(--text-main)]">
                                    -{formatCurrency(invoice.total_amount)}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Legal notice without colors over translucent backgrounds */}
                    <div className="bg-[var(--bg-secondary)] border border-[var(--border-soft)] rounded-xl p-4 flex items-start gap-3">
                        <AlertTriangle className="w-4 h-4 text-[var(--text-muted)] shrink-0 mt-0.5" />
                        <p className="text-xs text-[var(--text-muted)] leading-relaxed">
                            {dict.invoices.rectification_warning}
                        </p>
                    </div>

                    {/* Footer */}
                    <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-2 border-t border-[var(--border-soft)]">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => onOpenChange(false)}
                            disabled={loading}
                            className="bg-[var(--btn-cancel-bg)] text-[var(--btn-cancel-text)] border border-[var(--btn-cancel-border)] hover:bg-[var(--btn-cancel-hover-bg)] hover:text-[var(--btn-cancel-hover-text)] hover:border-transparent text-xs font-semibold rounded-xl px-5 py-2.5 cursor-pointer ui-motion"
                        >
                            {dict.invoices.cancel || "Cancelar"}
                        </Button>
                        <Button
                            type="submit"
                            disabled={loading || !reason.trim()}
                            className="bg-[var(--btn-primary-bg)] text-[var(--btn-primary-text)] hover:bg-[var(--btn-primary-hover-bg)] text-xs font-semibold rounded-xl px-5 py-2.5 border border-[var(--border-soft)] flex items-center justify-center gap-1.5 cursor-pointer ui-motion disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {loading ? (
                                <>
                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                    {dict.invoices.rectification_generating}
                                </>
                            ) : (
                                <>
                                    <FileX2 className="w-3.5 h-3.5" />
                                    {dict.invoices.rectification_confirm_btn}
                                </>
                            )}
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}
