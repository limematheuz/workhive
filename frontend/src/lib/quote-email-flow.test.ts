import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const quoteService = readFileSync(
    new URL("../services/quote.service.ts", import.meta.url),
    "utf8",
);
const quoteDetail = readFileSync(
    new URL("../components/quotes/QuoteDetailSheet.tsx", import.meta.url),
    "utf8",
);
const invoiceDetail = readFileSync(
    new URL("../components/invoices/InvoiceDetailView.tsx", import.meta.url),
    "utf8",
);
const sharedEmailDialog = readFileSync(
    new URL("../components/billing/DocumentEmailDialog.tsx", import.meta.url),
    "utf8",
);

test("quotes expose a dedicated email action through the shared safe email dialog", () => {
    assert.match(quoteService, /sendQuoteEmail: async/);
    assert.match(quoteService, /\/api\/v1\/quotes\/\$\{id\}\/send-email/);
    assert.match(quoteDetail, /DocumentEmailDialog/);
    assert.match(quoteDetail, /QuoteService\.sendQuoteEmail/);
    assert.match(quoteDetail, /documentLabel="presupuesto"/);
    assert.match(quoteDetail, /defaultSubject=\{quote\.title\}/);
    assert.match(invoiceDetail, /DocumentEmailDialog/);
    assert.match(sharedEmailDialog, /InvoiceEmailDialog as DocumentEmailDialog/);
});

test("quote downloads use the same tenant-protected backend PDF as email attachments", () => {
    assert.match(quoteService, /downloadQuotePdf: async/);
    assert.match(quoteService, /\/api\/v1\/quotes\/\$\{id\}\/pdf/);
    assert.match(quoteDetail, /QuoteService\.downloadQuotePdf\(quote\.id\)/);
    assert.doesNotMatch(quoteDetail, /printQuote/);
});
