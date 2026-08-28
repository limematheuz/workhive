import { Loader2, Plus, Trash2 } from "lucide-react";

import type { EmailSuggestion } from "./invoice-email-utils";
import { initials } from "./invoice-email-utils";
import { Button } from "@/components/ui/button";

type InvoiceEmailSuggestionsAsideProps = {
    isLoadingClients: boolean;
    canAddTypedEmails: boolean;
    validTypedEmails: string[];
    emailSuggestions: EmailSuggestion[];
    onAddRecipients: (emails: string[]) => void;
    onDeleteSavedContact: (contactId: number) => void;
    invoiceText: {
        email_suggestions_title: string;
        email_suggestions_description: string;
        email_loading_contacts: string;
        email_add_typed: string;
        email_empty_hint: string;
        email_remove_saved: string;
    };
};

export function InvoiceEmailSuggestionsAside({
    isLoadingClients,
    canAddTypedEmails,
    validTypedEmails,
    emailSuggestions,
    onAddRecipients,
    onDeleteSavedContact,
    invoiceText,
}: InvoiceEmailSuggestionsAsideProps) {
    return (
        <aside className="min-w-0 self-start overflow-hidden rounded-2xl border border-[var(--border-soft)] bg-[var(--bg-card)] shadow-lg shadow-black/[0.03] lg:sticky lg:top-0">
            <div className="border-b border-[var(--border-soft)] bg-[linear-gradient(135deg,var(--bg-secondary)_0%,var(--bg-card)_72%)] px-4 py-4">
                <p className="text-xs font-black uppercase tracking-wider text-[var(--text-muted)]">
                    {invoiceText.email_suggestions_title}
                </p>
                <p className="mt-1 text-xs text-[var(--text-muted)]">
                    {invoiceText.email_suggestions_description}
                </p>
            </div>
            <div className="max-h-[22rem] overflow-y-auto sm:max-h-[31rem] lg:max-h-[34rem]">
                {isLoadingClients ? (
                    <div className="flex items-center justify-center gap-2 px-4 py-10 text-sm text-[var(--text-muted)]">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        {invoiceText.email_loading_contacts}
                    </div>
                ) : canAddTypedEmails || emailSuggestions.length ? (
                    <>
                        {canAddTypedEmails && (
                            <Button
                                type="button"
                                onClick={() => onAddRecipients(validTypedEmails)}
                                variant="ghost"
                                className="h-auto w-full justify-start gap-3 rounded-none border-b border-[var(--border-soft)] px-4 py-3 text-left hover:bg-accent/5"
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
                            </Button>
                        )}

                        {emailSuggestions.map((suggestion) => (
                            <div
                                key={suggestion.key}
                                className="group flex items-center gap-1 border-b border-[var(--border-soft)] pr-2 last:border-b-0 hover:bg-[var(--bg-secondary)]"
                            >
                                <Button
                                    type="button"
                                    onClick={() => onAddRecipients([suggestion.email])}
                                    variant="ghost"
                                    className="h-auto min-w-0 flex-1 justify-start gap-3 rounded-none px-2 py-3 text-left"
                                >
                                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--bg-secondary)] text-xs font-black text-[var(--text-main)] ring-1 ring-[var(--border-soft)]">
                                        {initials(suggestion.name)}
                                    </span>
                                    <span className="min-w-0 flex-1">
                                        <span className="block truncate text-sm font-bold text-[var(--text-main)]">
                                            {suggestion.name}
                                        </span>
                                        {suggestion.name !== suggestion.email ? (
                                            <span className="block truncate text-xs text-[var(--text-muted)]">
                                                {suggestion.email}
                                            </span>
                                        ) : null}
                                        <span className="mt-1 inline-flex rounded-full bg-[var(--bg-secondary)] px-2 py-0.5 text-[10px] font-bold text-[var(--text-muted)]">
                                            {suggestion.meta}
                                        </span>
                                    </span>
                                </Button>
                                {suggestion.source === "contact" && suggestion.savedContactId ? (
                                    <Button
                                        type="button"
                                        onClick={() => onDeleteSavedContact(suggestion.savedContactId!)}
                                        variant="ghost"
                                        size="icon"
                                        className="shrink-0 rounded-lg border border-transparent text-[var(--text-muted)] hover:border-[var(--btn-cancel-border)] hover:bg-[var(--btn-cancel-bg)] hover:text-[var(--btn-cancel-text)]"
                                        aria-label={invoiceText.email_remove_saved.replace("{email}", suggestion.email)}
                                        title={invoiceText.email_remove_saved.replace("{email}", suggestion.email)}
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                ) : null}
                            </div>
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
