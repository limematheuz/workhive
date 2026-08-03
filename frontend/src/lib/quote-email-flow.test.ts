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

test("quotes expose a dedicated email action through the shared safe email dialog", () => {
    assert.match(quoteService, /sendQuoteEmail: async/);
    assert.match(quoteService, /\/api\/v1\/quotes\/\$\{id\}\/send-email/);
    assert.match(quoteDetail, /InvoiceEmailDialog/);
    assert.match(quoteDetail, /QuoteService\.sendQuoteEmail/);
    assert.match(quoteDetail, /documentLabel="presupuesto"/);
});
