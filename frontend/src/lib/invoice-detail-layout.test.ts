import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const document = readFileSync(
    new URL("../components/invoices/InvoiceDetailDocument.tsx", import.meta.url),
    "utf8",
);
const aside = readFileSync(
    new URL("../components/invoices/InvoiceDetailSummaryAside.tsx", import.meta.url),
    "utf8",
);

test("invoice detail keeps backlight out of the column grid so sticky aside stays aligned", () => {
    assert.match(document, /relative isolate mx-auto w-full max-w-\[112rem\]/);
    assert.match(document, /invoice-detail-backlight/);
    assert.match(document, /xl:grid-cols-\[minmax\(0,1fr\)_18rem\]/);
    assert.match(document, /xl:items-start/);
    // Backlight must not be a direct sibling competing for grid tracks with the document.
    assert.doesNotMatch(
        document,
        /grid[\s\S]*invoice-detail-backlight[\s\S]*billing-surface/,
    );
    assert.match(aside, /xl:sticky xl:top-0 xl:block xl:self-start/);
    assert.match(aside, /absolute left-4 right-4 top-3 h-1\.5 rounded-full bg-accent/);
});
