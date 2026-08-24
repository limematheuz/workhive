import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");

test("invoices open their detail in a modal with a fixed action header", () => {
    const page = read("../app/dashboard/invoices/page.tsx");
    const workspace = read("../components/invoices/use-invoices-workspace.ts");
    const list = read("../components/invoices/InvoicesListSection.tsx");
    const view = read("../components/invoices/InvoiceDetailView.tsx");
    const quoteSheet = read("../components/quotes/QuoteDetailSheet.tsx");

    assert.match(workspace, /const \[selectedInvoiceId, setSelectedInvoiceId\]/);
    assert.match(page, /onOpenInvoice: setSelectedInvoiceId/);
    assert.match(page, /<Dialog open=\{selectedInvoiceId !== null\}/);
    assert.doesNotMatch(page, /router\.push\(`\/dashboard\/invoices/);
    assert.doesNotMatch(list, /href=\{`\/dashboard\/invoices/);
    assert.match(view, /flex-none p-3 pb-0/);
    assert.match(view, /min-h-0 flex-1 overflow-y-auto overflow-x-hidden/);
    assert.match(page, /sm:max-w-6xl lg:max-w-7xl/);
    assert.match(quoteSheet, /sm:max-w-6xl lg:max-w-7xl/);
});
