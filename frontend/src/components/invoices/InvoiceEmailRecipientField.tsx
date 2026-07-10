import type { KeyboardEvent } from "react";
import { Loader2, Plus } from "lucide-react";

import type { EmailSuggestion } from "./invoice-email-utils";
import { initials } from "./invoice-email-utils";
import { InvoiceEmailChip } from "./InvoiceEmailChip";

type InvoiceEmailRecipientFieldProps = {
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
    removeLabel: string;
    searchPlaceholder: string;
    loadingContactsLabel: string;
    addTypedLabel: string;
};

export function InvoiceEmailRecipientField({
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
    removeLabel,
    searchPlaceholder,
    loadingContactsLabel,
    addTypedLabel,
}: InvoiceEmailRecipientFieldProps) {
    return (
        <div className="relative min-w-0">
            <div className="flex min-h-11 w-full flex-wrap items-center gap-2 rounded-xl border border-transparent bg-[var(--bg-secondary)] px-3 py-2 ring-1 ring-[var(--border-soft)] transition-with-transform focus-within:bg-[var(--bg-card)] focus-within:ring-2 focus-within:ring-accent/50">
                {recipients.map((email) => (
                    <InvoiceEmailChip
                        key={email}
                        email={email}
                        onRemove={onRemoveRecipient}
                        removeLabel={removeLabel}
                    />
                ))}
                <input
                    type="email"
                    value={search}
                    onFocus={onSearchFocus}
                    onChange={(event) => onSearchChange(event.target.value)}
                    onKeyDown={onRecipientKeyDown}
                    onBlur={onSearchBlur}
                    placeholder={recipients.length ? "" : searchPlaceholder}
                    className="invoice-email-token-input min-w-[12rem] flex-1 bg-transparent px-1 py-1.5 text-sm text-[var(--text-main)] outline-none placeholder:text-[var(--text-muted)]"
                />
            </div>
            {isRecipientMenuOpen && (canAddTypedEmails || emailSuggestions.length > 0 || isLoadingClients) && (
                <div className="absolute left-0 right-0 top-[calc(100%+0.5rem)] z-50 max-h-72 overflow-y-auto rounded-2xl border border-[var(--border-soft)] bg-[var(--bg-card-solid)] p-1 shadow-2xl shadow-black/20">
                    {isLoadingClients && (
                        <div className="flex items-center gap-2 px-3 py-3 text-sm text-[var(--text-muted)]">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            {loadingContactsLabel}
                        </div>
                    )}
                    {canAddTypedEmails && (
                        <button
                            type="button"
                            onMouseDown={(event) => event.preventDefault()}
                            onClick={() => onAddRecipients(validTypedEmails)}
                            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition hover:bg-accent/5"
                        >
                            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent text-white">
                                <Plus className="h-4 w-4" />
                            </span>
                            <span className="min-w-0 flex-1">
                                <span className="block truncate text-sm font-bold text-[var(--text-main)]">
                                    {addTypedLabel}
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
                            onMouseDown={(event) => event.preventDefault()}
                            onClick={() => onAddRecipients([suggestion.email])}
                            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition hover:bg-[var(--bg-secondary)]"
                        >
                            <span
                                className={[
                                    "flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-black ring-1",
                                    suggestion.source === "client"
                                        ? "bg-accent/10 text-accent ring-accent/15"
                                        : "bg-[var(--bg-secondary)] text-[var(--text-main)] ring-[var(--border-soft)]",
                                ].join(" ")}
                            >
                                {initials(suggestion.name)}
                            </span>
                            <span className="min-w-0 flex-1">
                                <span className="block truncate text-sm font-bold text-[var(--text-main)]">
                                    {suggestion.name}
                                </span>
                                <span className="block truncate text-xs text-[var(--text-muted)]">
                                    {suggestion.email}
                                </span>
                            </span>
                            <span className="hidden shrink-0 rounded-full bg-[var(--bg-secondary)] px-2 py-1 text-[10px] font-bold text-[var(--text-muted)] sm:inline-flex">
                                {suggestion.meta}
                            </span>
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}
