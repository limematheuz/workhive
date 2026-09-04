import type { Client, ClientContact } from "../types/client.ts";

function normalizedText(value: string | null | undefined): string {
    return (value ?? "")
        .trim()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLocaleLowerCase();
}

function normalizedPhone(value: string | null | undefined): string {
    return (value ?? "").replace(/\D/g, "");
}

/**
 * Identifies the contact copied from the original client fields by the
 * contacts migration. It stays persisted for history, but is account-holder
 * data rather than an additional person to show in the contacts workspace.
 */
export function isAccountHolderMirror(
    client: Client,
    contact: ClientContact,
): boolean {
    if (contact.roles.length > 0 || normalizedText(contact.full_name) !== normalizedText(client.name)) {
        return false;
    }

    const sameEmail = Boolean(
        normalizedText(client.email)
        && normalizedText(client.email) === normalizedText(contact.email),
    );
    const samePhone = Boolean(
        normalizedPhone(client.phone)
        && normalizedPhone(client.phone) === normalizedPhone(contact.phone),
    );

    return sameEmail || samePhone;
}
