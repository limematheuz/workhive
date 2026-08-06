import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
    buildEmailSuggestions,
    uniqueEmails,
    withoutRecipientDuplicates,
} from "../components/invoices/invoice-email-utils.ts";
import type { InvoiceEmailContact } from "../services/invoice-email-contact.service.ts";

test("primary and copy recipients remain mutually exclusive", () => {
    const toRecipients = uniqueEmails(
        ["client@example.com"],
        ["COPY@example.com"],
    );

    assert.deepEqual(
        withoutRecipientDuplicates(
            ["client@example.com", "copy@example.com", "team@example.com"],
            toRecipients,
        ),
        ["team@example.com"],
    );
});

test("saved email suggestions are email-only and ordered by real use", () => {
    const savedContacts: InvoiceEmailContact[] = [
        {
            id: 1,
            company_id: 1,
            name: "Incorrect legacy label",
            email: "once@example.com",
            source: "invoice_email",
            use_count: 1,
            last_used_at: "2026-08-01T10:00:00Z",
            created_at: "2026-08-01T10:00:00Z",
            updated_at: "2026-08-01T10:00:00Z",
        },
        {
            id: 2,
            company_id: 1,
            name: null,
            email: "often@example.com",
            source: "invoice_email",
            use_count: 6,
            last_used_at: "2026-08-01T11:00:00Z",
            created_at: "2026-08-01T10:00:00Z",
            updated_at: "2026-08-01T10:00:00Z",
        },
    ];

    const suggestions = buildEmailSuggestions({
        clients: [],
        savedContacts,
        recipients: [],
        search: "",
        invoiceText: {
            email_client_meta: "Client",
            email_saved_meta: "Saved email",
            email_saved_meta_with_count: "Saved email · {count} uses",
        },
    });

    assert.deepEqual(
        suggestions.map((suggestion) => suggestion.email),
        ["often@example.com", "once@example.com"],
    );
    assert.equal(suggestions[1].name, "once@example.com");
});

test("the shared dialog requires an explicit decision before persistence", () => {
    const dialog = readFileSync(
        new URL("../components/invoices/InvoiceEmailDialog.tsx", import.meta.url),
        "utf8",
    );
    const contactService = readFileSync(
        new URL("../services/invoice-email-contact.service.ts", import.meta.url),
        "utf8",
    );
    const footer = readFileSync(
        new URL("../components/invoices/InvoiceEmailDialogFooter.tsx", import.meta.url),
        "utf8",
    );
    const suggestionsAside = readFileSync(
        new URL("../components/invoices/InvoiceEmailSuggestionsAside.tsx", import.meta.url),
        "utf8",
    );

    assert.match(dialog, /saveRecipients.*useState\(false\)/);
    assert.match(dialog, /save_recipient_to_client_id/);
    assert.match(contactService, /deleteContact: async/);
    assert.match(footer, /from "@\/components\/ui\/checkbox"/);
    assert.doesNotMatch(footer, /type="checkbox"/);
    assert.match(suggestionsAside, /onDeleteSavedContact/);
    assert.doesNotMatch(suggestionsAside, /sm:opacity-0/);
});
