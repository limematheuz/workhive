import type { Dispatch, SetStateAction } from "react";

import type { Client } from "@/services/client.service";
import type { InvoiceEmailContact } from "@/services/invoice-email-contact.service";

export type EmailSetter = Dispatch<SetStateAction<string[]>>;

export type EmailSuggestion = {
    key: string;
    name: string;
    email: string;
    meta: string;
    source: "client" | "contact";
    savedContactId?: number;
};

export const isValidEmail = (value: string) =>
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());

export const normalized = (value: unknown) => String(value ?? "").toLowerCase().trim();

export const splitEmailInput = (value: string) =>
    value
        .split(/[,\s;]+/)
        .flatMap((email) => {
            const trimmed = email.trim();
            return trimmed ? [trimmed] : [];
        });

export const uniqueEmails = (current: string[], emails: string[]) => {
    const next = new Map(current.map((email) => [normalized(email), email]));
    for (const email of emails) {
        if (!isValidEmail(email)) continue;
        const trimmed = email.trim();
        next.set(normalized(trimmed), trimmed);
    }
    return Array.from(next.values());
};

export const withoutRecipientDuplicates = (
    emails: string[],
    recipientEmails: string[],
) => {
    const recipientSet = new Set(recipientEmails.map(normalized));
    return uniqueEmails([], emails).filter(
        (email) => !recipientSet.has(normalized(email)),
    );
};

export const addEmailValues = (
    setter: EmailSetter,
    emails: string[],
    clearInput: () => void,
) => {
    const validEmails = emails.filter(isValidEmail);
    if (!validEmails.length) return;
    setter((current) => uniqueEmails(current, validEmails));
    clearInput();
};

export const initials = (name: string) =>
    name
        .split(" ")
        .map((part) => part[0])
        .join("")
        .slice(0, 2)
        .toUpperCase() || "WH";

type BuildEmailSuggestionsParams = {
    clients: Client[];
    savedContacts: InvoiceEmailContact[];
    recipients: string[];
    search: string;
    invoiceText: {
        email_client_meta: string;
        email_saved_meta: string;
        email_saved_meta_with_count: string;
    };
};

export const buildEmailSuggestions = ({
    clients,
    savedContacts,
    recipients,
    search,
    invoiceText,
}: BuildEmailSuggestionsParams): EmailSuggestion[] => {
    const seen = new Set<string>();
    const selected = new Set(recipients.map(normalized));
    const term = normalized(search);
    const contactSuggestions = [...savedContacts]
        .sort((left, right) => (
            right.use_count - left.use_count
            || String(right.last_used_at || "").localeCompare(String(left.last_used_at || ""))
            || left.email.localeCompare(right.email)
        ))
        .flatMap((contact) => {
        const email = String(contact.email || "");
        const normalizedEmail = normalized(email);
        if (seen.has(normalizedEmail) || selected.has(normalizedEmail)) {
            return [];
        }
        if (term) {
            const matches = [
                contact.email,
            ].some((value) => normalized(value).includes(term));
            if (!matches) return [];
        }
        seen.add(normalizedEmail);
        return [{
            key: `contact-${contact.id}-${contact.email}`,
            // A saved address is a standalone suggestion.  It is not a client
            // relationship, so a typed test address can never be presented as
            // that client's email later on.
            name: contact.email,
            email: contact.email,
            meta: contact.use_count > 1
                ? invoiceText.email_saved_meta_with_count.replace("{count}", contact.use_count.toString())
                : invoiceText.email_saved_meta,
            source: "contact" as const,
            savedContactId: contact.id,
        }];
    });
    const clientSuggestions = clients.flatMap((client) => {
        if (!client.email) return [];
        const email = String(client.email || "");
        const normalizedEmail = normalized(email);
        if (seen.has(normalizedEmail) || selected.has(normalizedEmail)) {
            return [];
        }
        if (term) {
            const matches = [
                client.name,
                client.email,
                client.legal_number,
            ].some((value) => normalized(value).includes(term));
            if (!matches) return [];
        }
        seen.add(normalizedEmail);
        return [{
            key: `client-${client.id}-${client.email}`,
            name: client.name,
            email,
            meta: client.legal_number ? `${invoiceText.email_client_meta} · ${client.legal_number}` : invoiceText.email_client_meta,
            source: "client" as const,
        }];
    });
    return [...contactSuggestions, ...clientSuggestions].slice(0, 12);
};

export const getKnownRecipientEmails = (
    clients: Client[],
    savedContacts: InvoiceEmailContact[],
) => {
    return new Set([
        ...clients.map((client) => normalized(client.email)),
        ...savedContacts.map((contact) => normalized(contact.email)),
    ].filter(Boolean));
};
