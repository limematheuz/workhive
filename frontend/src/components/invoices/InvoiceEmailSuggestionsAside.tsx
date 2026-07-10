import { Loader2, Plus } from "lucide-react";

import type { EmailSuggestion } from "./invoice-email-utils";
import { initials } from "./invoice-email-utils";

type InvoiceEmailSuggestionsAsideProps = {
    isLoadingClients: boolean;
    canAddTypedEmails: boolean;
    validTypedEmails: string[];
    emailSuggestions: EmailSuggestion[];
    onAddRecipients: (emails: string[]) => void;
    invoiceText: {
        email_suggestions_title: string;
        email_suggestions_description: string;
        email_loading_contacts: string;
        email_add_typed: string;
        email_empty_hint: string;
    };
};

export function InvoiceEmailSuggestionsAside({
    isLoadingClients,
    canAddTypedEmails,
    validTypedEmails,
    emailSuggestions,
    onAddRecipients,
    invoiceText,
}: InvoiceEmailSuggestionsAsideProps) {
    return (
        <aside className="min-w-0 overflow-hidden rounded-2xl border border-[var(--border-soft)] bg-[var(--bg-card)] shadow-sm">
            <div className="border-b border-[var(--border-soft)] px-4 py-3">
                <p className="text-xs font-black uppercase tracking-wider text-[var(--text-muted)]">
                    {invoiceText.email_suggestions_title}
                </p>
                <p className="mt-1 text-xs text-[var(--text-muted)]">
                    {invoiceText.email_suggestions_description}
                </p>
            </div>
            <div className="max-h-[22rem] overflow-y-auto sm:max-h-[31rem]">
                {isLoadingClients ? (
                    <div className="flex items-center justify-center gap-2 px-4 py-10 text-sm text-[var(--text-muted)]">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        {invoiceText.email_loading_contacts}
                    </div>
                ) : canAddTypedEmails || emailSuggestions.length ? (
                    <>
                        {canAddTypedEmails && (
                            <button
                                type="button"
                                onClick={() => onAddRecipients(validTypedEmails)}
                                className="flex w-full items-center gap-3 border-b border-[var(--border-soft)] px-4 py-3 text-left transition hover:bg-accent/5"
                            >
                                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent text-white">
                                    <Plus className="h-4 w-4" />
                                </span>
                                <span className="min-w-0 flex-1">
                                    <span className="block truncate text-sm font-bold text-[var(--text-main)]">
                                        {invoiceText.email_add_typed}
                                    </span>
                                    <span className="block truncate text-xs text-[var(--text-muted)]">
                                        {validTypedEmails.join(", ")}
                                    </span>
                                </span>
                            </button>
                        )}

                        {emailSuggestions.map((suggestion) => (
                            <button
                                key={suggestion.key}
                                type="button"
                                onClick={() => onAddRecipients([suggestion.email])}
                                className="flex w-full items-center gap-3 border-b border-[var(--border-soft)] px-4 py-3 text-left transition last:border-b-0 hover:bg-[var(--bg-secondary)]"
                            >
                                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--bg-secondary)] text-xs font-black text-[var(--text-main)] ring-1 ring-[var(--border-soft)]">
                                    {initials(suggestion.name)}
                                </span>
                                <span className="min-w-0 flex-1">
                                    <span className="block truncate text-sm font-bold text-[var(--text-main)]">
                                        {suggestion.name}
                                    </span>
                                    <span className="block truncate text-xs text-[var(--text-muted)]">
                                        {suggestion.email}
                                    </span>
                                    <span className="mt-1 inline-flex rounded-full bg-[var(--bg-secondary)] px-2 py-0.5 text-[10px] font-bold text-[var(--text-muted)]">
                                        {suggestion.meta}
                                    </span>
                                </span>
                            </button>
                        ))}
                    </>
                ) : (
                    <div className="px-4 py-10 text-center text-sm text-[var(--text-muted)]">
                        {invoiceText.email_empty_hint}
                    </div>
                )}
            </div>
        </aside>
    );
}
