import type { ReactNode } from "react";
import { Loader2, Send } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";

type InvoiceEmailDialogFooterProps = {
    sendCopy: boolean;
    onSendCopyChange: (checked: boolean) => void;
    saveRecipients: boolean;
    onSaveRecipientsChange: (checked: boolean) => void;
    showSaveRecipients: boolean;
    saveRecipientToClient: boolean;
    onSaveRecipientToClientChange: (checked: boolean) => void;
    saveRecipientToClientLabel?: string;
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

type EmailOptionProps = {
    id: string;
    checked: boolean;
    onCheckedChange: (checked: boolean) => void;
    children: ReactNode;
    highlighted?: boolean;
};

function EmailOption({
    id,
    checked,
    onCheckedChange,
    children,
    highlighted = false,
}: EmailOptionProps) {
    return (
        <div
            className={`flex min-h-11 shrink-0 items-center gap-2.5 rounded-xl border px-3 ${
                highlighted
                    ? "border-accent/20 bg-accent/5"
                    : "border-[var(--border-soft)] bg-[var(--bg-secondary)]"
            }`}
        >
            <Checkbox
                id={id}
                checked={checked}
                onCheckedChange={(value) => onCheckedChange(value === true)}
            />
            <label
                htmlFor={id}
                className="cursor-pointer select-none text-sm font-semibold leading-none text-[var(--text-main)]"
            >
                {children}
            </label>
        </div>
    );
}

export function InvoiceEmailDialogFooter({
    sendCopy,
    onSendCopyChange,
    saveRecipients,
    onSaveRecipientsChange,
    showSaveRecipients,
    saveRecipientToClient,
    onSaveRecipientToClientChange,
    saveRecipientToClientLabel,
    canSend,
    isSending,
    onCancel,
    onSend,
    submitLabel,
    invoiceText,
}: InvoiceEmailDialogFooterProps) {
    return (
        <footer className="dialog-glass-chrome grid gap-4 border-t border-[var(--border-soft)] px-5 py-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
            <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:flex-wrap">
                <EmailOption
                    id="document-email-send-copy"
                    checked={sendCopy}
                    onCheckedChange={onSendCopyChange}
                >
                    {invoiceText.email_send_copy}
                </EmailOption>
                {showSaveRecipients && (
                    <EmailOption
                        id="document-email-save-suggestion"
                        checked={saveRecipients}
                        onCheckedChange={onSaveRecipientsChange}
                        highlighted
                    >
                        {invoiceText.email_save_new}
                    </EmailOption>
                )}
                {saveRecipientToClientLabel ? (
                    <EmailOption
                        id="document-email-save-client"
                        checked={saveRecipientToClient}
                        onCheckedChange={onSaveRecipientToClientChange}
                        highlighted
                    >
                        {saveRecipientToClientLabel}
                    </EmailOption>
                ) : null}
            </div>
            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-self-end">
                <Button
                    type="button"
                    variant="dangerSoft"
                    onClick={onCancel}
                    disabled={isSending}
                    className="min-h-11 px-5"
                >
                    {invoiceText.cancel}
                </Button>
                <Button
                    type="button"
                    onClick={onSend}
                    disabled={!canSend}
                    className="min-h-11 gap-2 px-5"
                >
                    {isSending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                        <Send className="h-4 w-4" />
                    )}
                    {submitLabel || invoiceText.send_email}
                </Button>
            </div>
        </footer>
    );
}
