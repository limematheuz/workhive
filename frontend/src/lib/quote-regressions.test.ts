import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function source(path: string): string {
    return readFileSync(new URL(path, import.meta.url), "utf8");
}

test("quote form preserves 0% tax rate on edit and revision prefill", () => {
    const hook = source("../hooks/useQuoteForm.ts");
    assert.doesNotMatch(hook, /quoteToEdit\.tax_rate\s*\|\|\s*DEFAULT_QUOTE_TAX_RATE/);
    assert.match(hook, /quoteToEdit\.tax_rate\s*\?\?\s*DEFAULT_QUOTE_TAX_RATE/);
});

test("shared DocumentFormDialog routes Cancel through useDialogDismiss", () => {
    const dialog = source("../components/billing/DocumentFormDialog.tsx");
    assert.match(dialog, /useDialogDismiss/);
});

test("QuoteService routes every mutation and item call through assertApiResponseOk", () => {
    const service = source("../services/quote.service.ts");
    const assertCalls = service.match(/assertApiResponseOk\(/g) ?? [];
    assert.ok(
        assertCalls.length >= 11,
        `Expected all QuoteService endpoints to use assertApiResponseOk, found ${assertCalls.length}`,
    );
    assert.doesNotMatch(service, /err\.detail\s*\|\|/);
});

test("QuotesPage avoids stale detail fallback, false empty state, and all-or-nothing client loading", () => {
    const page = source("../app/dashboard/quotes/page.tsx");
    assert.doesNotMatch(page, /setSelectedQuote\(quote\)\s*;\s*\}\s*setIsDetailOpen\(true\)/);
    assert.match(page, /Promise\.allSettled/);
    assert.match(page, /loadError/);
});

test("QuoteDetailSheet keeps open detail in sync after sending email", () => {
    const detailSheet = source("../components/quotes/QuoteDetailSheet.tsx");
    assert.match(detailSheet, /handleSendEmail[\s\S]*onQuoteUpdated\(/);
    assert.match(detailSheet, /QuoteService\.getQuote\(quote\.id\)|onQuoteUpdated\(fresh/);
});
