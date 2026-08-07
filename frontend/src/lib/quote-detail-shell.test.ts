import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const sheet = readFileSync(
    new URL("../components/quotes/QuoteDetailSheet.tsx", import.meta.url),
    "utf8",
);
const actions = readFileSync(
    new URL("../components/quotes/QuoteDetailActions.tsx", import.meta.url),
    "utf8",
);
const meta = readFileSync(
    new URL("../components/quotes/QuoteDetailMeta.tsx", import.meta.url),
    "utf8",
);
const items = readFileSync(
    new URL("../components/quotes/QuoteDetailItems.tsx", import.meta.url),
    "utf8",
);
const notes = readFileSync(
    new URL("../components/quotes/QuoteDetailNotes.tsx", import.meta.url),
    "utf8",
);
const aside = readFileSync(
    new URL("../components/quotes/QuoteDetailSummaryAside.tsx", import.meta.url),
    "utf8",
);
const invoiceDocument = readFileSync(
    new URL("../components/invoices/InvoiceDetailDocument.tsx", import.meta.url),
    "utf8",
);
const invoiceActionBar = readFileSync(
    new URL("../components/invoices/InvoiceDetailActionBar.tsx", import.meta.url),
    "utf8",
);

test("quote detail mirrors invoice document shell tokens", () => {
    assert.match(sheet, /billing-surface/);
    assert.match(sheet, /rounded-full bg-accent/);
    assert.match(sheet, /QuoteDetailSummaryAside/);
    assert.match(sheet, /sm:max-w-6xl/);
    assert.match(invoiceDocument, /billing-surface/);
    assert.match(invoiceDocument, /rounded-full bg-accent/);
});

test("quote detail actions mirror invoice action bar summary pattern", () => {
    assert.match(actions, /billing-surface/);
    assert.match(actions, /summaryCards/);
    assert.match(actions, /from \"@\/components\/ui\/button\"/);
    assert.match(invoiceActionBar, /billing-surface/);
});

test("quote detail header and notes use tertiary blocks like invoices", () => {
    assert.match(meta, /bg-\[var\(--bg-tertiary\)\]/);
    assert.match(meta, /dict\.invoices\?\.issuer|dict\.invoices\.issuer/);
    assert.match(meta, /dict\.invoices\?\.billed_to|dict\.invoices\.billed_to/);
    assert.match(notes, /bg-\[var\(--bg-tertiary\)\]/);
    assert.match(aside, /billing-surface/);
    assert.match(aside, /bg-\[var\(--bg-tertiary\)\]/);
});

test("quote detail items table keeps invoice concept accent border", () => {
    assert.match(items, /border-l-2 border-\[var\(--accent-color\)\]/);
    assert.match(items, /bg-\[var\(--bg-tertiary\)\]\/65/);
    assert.match(items, /formatCurrency\(quote\.total_amount\)/);
});
