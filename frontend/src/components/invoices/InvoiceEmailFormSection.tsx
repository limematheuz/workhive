import type { KeyboardEvent } from "react";
import { FileText, Paperclip } from "lucide-react";

import { InvoiceEmailChip } from "./InvoiceEmailChip";
import { InvoiceEmailRecipientField } from "./InvoiceEmailRecipientField";
import type { EmailSuggestion } from "./invoice-email-utils";
import { initials } from "./invoice-email-utils";

type InvoiceEmailFormSectionProps = {
    fromName: string;
    fromEmail: string;
    recipients: string[];
    search: string;
    onSearchChange: (value: string) => void;
    onSearchFocus: () => void;
    onSearchBlur: () => void;
    onRecipientKeyDown: (event: KeyboardEvent<HTMLInputElement>) => void;
    onRemoveRecipient: (email: string) => void;
    onAddRecipients: (emails: string[]) => void;
    validTypedEmails: string[];
    canAddTypedEmails: boolean;
    emailSuggestions: EmailSuggestion[];
    isLoadingClients: boolean;
    isRecipientMenuOpen: boolean;
    copyRecipients: string[];
    copySearch: string;
    onCopySearchChange: (value: string) => void;
    onCopyKeyDown: (event: KeyboardEvent<HTMLInputElement>) => void;
    onCopyBlur: () => void;
    onRemoveCopyRecipient: (email: string) => void;
    subject: string;
    onSubjectChange: (value: string) => void;
    message: string;
    onMessageChange: (value: string) => void;
    invoiceNumber: string;
    invoiceText: {
        email_from_label: string;
        email_to_label: string;
        email_cc_label: string;
        email_subject_label: string;
        email_remove_label: string;
        email_search_placeholder: string;
        email_loading_contacts: string;
        email_add_typed: string;
        email_cc_placeholder: string;
        email_pdf_attachment: string;
    };
};

export function InvoiceEmailFormSection({
    fromName,
    fromEmail,
    recipients,
    search,
    onSearchChange,
    onSearchFocus,
    onSearchBlur,
    onRecipientKeyDown,
    onRemoveRecipient,
    onAddRecipients,
    validTypedEmails,
    canAddTypedEmails,
    emailSuggestions,
    isLoadingClients,
    isRecipientMenuOpen,
    copyRecipients,
    copySearch,
    onCopySearchChange,
    onCopyKeyDown,
    onCopyBlur,
    onRemoveCopyRecipient,
    subject,
    onSubjectChange,
    message,
    onMessageChange,
    invoiceNumber,
    invoiceText,
}: InvoiceEmailFormSectionProps) {
    return (
        <section className="min-w-0 rounded-2xl border border-[var(--border-soft)] bg-[var(--bg-card)] shadow-sm">
            <div className="divide-y divide-[var(--border-soft)]">
                <div className="grid gap-2 px-4 py-3 sm:grid-cols-[5rem_minmax(0,1fr)] sm:items-center">
                    <span className="text-xs font-black uppercase tracking-wider text-[var(--text-muted)]">
                        {invoiceText.email_from_label}
                    </span>
                    <div className="flex min-w-0 items-center gap-3">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent/10 text-xs font-black text-accent">
                            {initials(fromName)}
                        </span>
                        <span className="min-w-0">
                            <span className="block truncate text-sm font-bold text-[var(--text-main)]">
                                {fromName}
                            </span>
                            {fromEmail && (
                                <span className="block truncate text-xs text-[var(--text-muted)]">
                                    {fromEmail}
                                </span>
                            )}
                        </span>
                    </div>
                </div>

                <div className="grid gap-2 px-4 py-3 sm:grid-cols-[5rem_minmax(0,1fr)] sm:items-start">
                    <span className="pt-2 text-xs font-black uppercase tracking-wider text-[var(--text-muted)]">
                        {invoiceText.email_to_label}
                    </span>
                    <InvoiceEmailRecipientField
                        recipients={recipients}
                        search={search}
                        onSearchChange={onSearchChange}
                        onSearchFocus={onSearchFocus}
                        onSearchBlur={onSearchBlur}
                        onRecipientKeyDown={onRecipientKeyDown}
                        onRemoveRecipient={onRemoveRecipient}
                        onAddRecipients={onAddRecipients}
                        validTypedEmails={validTypedEmails}
                        canAddTypedEmails={canAddTypedEmails}
                        emailSuggestions={emailSuggestions}
                        isLoadingClients={isLoadingClients}
                        isRecipientMenuOpen={isRecipientMenuOpen}
                        removeLabel={invoiceText.email_remove_label}
                        searchPlaceholder={invoiceText.email_search_placeholder}
                        loadingContactsLabel={invoiceText.email_loading_contacts}
                        addTypedLabel={invoiceText.email_add_typed}
                    />
                </div>

                <div className="grid gap-2 px-4 py-3 sm:grid-cols-[5rem_minmax(0,1fr)] sm:items-start">
                    <span className="pt-2 text-xs font-black uppercase tracking-wider text-[var(--text-muted)]">
                        {invoiceText.email_cc_label}
                    </span>
                    <div className="flex min-h-11 w-full flex-wrap items-center gap-2 rounded-xl bg-[var(--bg-secondary)] px-3 py-2 ring-1 ring-[var(--border-soft)] transition-with-transform focus-within:bg-[var(--bg-card)] focus-within:ring-2 focus-within:ring-accent/50">
                        {copyRecipients.map((email) => (
                            <InvoiceEmailChip
                                key={email}
                                email={email}
                                onRemove={onRemoveCopyRecipient}
                                removeLabel={invoiceText.email_remove_label}
                                tone="muted"
                            />
                        ))}
                        <input
                            type="email"
                            value={copySearch}
                            onChange={(event) => onCopySearchChange(event.target.value)}
                            onKeyDown={onCopyKeyDown}
                            onBlur={onCopyBlur}
                            placeholder={copyRecipients.length ? "" : invoiceText.email_cc_placeholder}
                            className="invoice-email-token-input min-w-[12rem] flex-1 bg-transparent px-1 py-1.5 text-sm text-[var(--text-main)] outline-none placeholder:text-[var(--text-muted)]"
                        />
                    </div>
                </div>

                <div className="!grid gap-2 px-4 py-3 sm:grid-cols-[5rem_minmax(0,1fr)] sm:items-center">
                    <span className="text-xs font-black uppercase tracking-wider text-[var(--text-muted)]">
                        {invoiceText.email_subject_label}
                    </span>
                    <input
                        value={subject}
                        onChange={(event) => onSubjectChange(event.target.value)}
                        maxLength={200}
                        aria-label={invoiceText.email_subject_label}
                        className="h-11 w-full min-w-0 rounded-xl bg-[var(--bg-secondary)] px-3 text-sm font-semibold text-[var(--text-main)] outline-none ring-1 ring-[var(--border-soft)] transition focus:bg-[var(--bg-card)] focus:ring-2 focus:ring-accent/50"
                    />
                </div>
            </div>

            <textarea
                value={message}
                onChange={(event) => onMessageChange(event.target.value)}
                maxLength={2000}
                aria-label="Mensaje"
                className="invoice-email-message-field h-72 w-full resize-y border-0 bg-[var(--bg-card)] px-5 py-5 text-sm leading-7 text-[var(--text-main)] outline-none placeholder:text-[var(--text-muted)] lg:h-80"
            />

            <div className="border-t border-[var(--border-soft)] bg-[var(--bg-secondary)]/55 p-4">
                <div className="flex items-center gap-3 rounded-xl border border-[var(--border-soft)] bg-[var(--bg-card)] px-4 py-3">
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-rose-500/10 text-rose-500">
                        <FileText className="h-5 w-5" />
                    </span>
                    <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-black text-[var(--text-main)]">
                            {invoiceNumber}.pdf
                        </span>
                        <span className="flex items-center gap-1 text-xs text-[var(--text-muted)]">
                            <Paperclip className="h-3.5 w-3.5" />
                            {invoiceText.email_pdf_attachment}
                        </span>
                    </span>
                </div>
            </div>
        </section>
    );
}
