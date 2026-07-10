import { Loader2, Send } from "lucide-react";

import { Button } from "@/components/ui/button";
import { DialogFooter } from "@/components/ui/dialog";

type InvoiceEmailDialogFooterProps = {
    sendCopy: boolean;
    onSendCopyChange: (checked: boolean) => void;
    saveRecipients: boolean;
    onSaveRecipientsChange: (checked: boolean) => void;
    showSaveRecipients: boolean;
    canSend: boolean;
    isSending: boolean;
    onCancel: () => void;
    onSend: () => void;
    submitLabel?: string;
    invoiceText: {
        email_send_copy: string;
        email_save_new: string;
        cancel: string;
        send_email: string;
    };
};

export function InvoiceEmailDialogFooter({
    sendCopy,
    onSendCopyChange,
    saveRecipients,
    onSaveRecipientsChange,
    showSaveRecipients,
    canSend,
    isSending,
    onCancel,
    onSend,
    submitLabel,
    invoiceText,
}: InvoiceEmailDialogFooterProps) {
    return (
        <DialogFooter className="items-center justify-between gap-3 border-t border-[var(--border-soft)] bg-[var(--bg-card)] px-5 py-4 sm:flex-row">
            <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap">
                <label className="flex w-full items-center gap-3 rounded-xl border border-[var(--border-soft)] bg-[var(--bg-secondary)] px-3 py-2 text-sm font-semibold text-[var(--text-main)] sm:w-auto">
                    <input
                        type="checkbox"
                        checked={sendCopy}
                        onChange={(event) => onSendCopyChange(event.target.checked)}
                        className="h-4 w-4 accent-[var(--accent-color)]"
                    />
                    {invoiceText.email_send_copy}
                </label>
                {showSaveRecipients && (
                    <label className="flex w-full items-center gap-3 rounded-xl border border-accent/20 bg-accent/5 px-3 py-2 text-sm font-semibold text-[var(--text-main)] sm:w-auto">
                        <input
                            type="checkbox"
                            checked={saveRecipients}
                            onChange={(event) => onSaveRecipientsChange(event.target.checked)}
                            className="h-4 w-4 accent-[var(--accent-color)]"
                        />
                        {invoiceText.email_save_new}
                    </label>
                )}
            </div>
            <div className="flex w-full flex-col-reverse gap-2 sm:w-auto sm:flex-row">
                <Button
                    type="button"
                    variant="outline"
                    onClick={onCancel}
                    disabled={isSending}
                >
                    {invoiceText.cancel}
                </Button>
                <Button
                    type="button"
                    onClick={onSend}
                    disabled={!canSend}
                    className="gap-2"
                >
                    {isSending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                        <Send className="h-4 w-4" />
                    )}
                    {submitLabel || invoiceText.send_email}
                </Button>
            </div>
        </DialogFooter>
    );
}
