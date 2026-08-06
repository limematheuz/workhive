import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function source(path: string): string {
    return readFileSync(new URL(path, import.meta.url), "utf8");
}

test("quote and invoice creation keep company branding out of transactional forms", () => {
    const formSources = [
        source("../components/quotes/QuoteCreateSheet.tsx"),
        source("../components/invoices/InvoiceCreateSheetDetails.tsx"),
    ];

    for (const formSource of formSources) {
        assert.doesNotMatch(formSource, /CompanyLogoUpload/);
    }
    assert.doesNotMatch(source("../hooks/useQuoteForm.ts"), /companyLogo/);
    assert.doesNotMatch(source("../hooks/useInvoiceForm.ts"), /companyLogo/);
});

test("optional document fields are disclosed progressively", () => {
    const quoteForm = source("../components/quotes/QuoteCreateSheet.tsx");
    const invoiceForm = source("../components/invoices/InvoiceCreateSheetDetails.tsx");
    const invoiceSidebar = source("../components/invoices/InvoiceCreateSheetSidebar.tsx");
    const sharedSection = source("../components/billing/DocumentFormSection.tsx");

    assert.match(quoteForm, /Opciones avanzadas/);
    assert.match(invoiceForm, /Datos adicionales/);
    assert.match(invoiceSidebar, /Firma opcional/);
    assert.match(quoteForm, /DocumentFormSection/);
    assert.match(invoiceForm, /DocumentFormSection/);
    assert.match(sharedSection, /rounded-\[22px\]/);
    assert.match(quoteForm, /ChevronDown/);
    assert.match(invoiceForm, /ChevronDown/);
    assert.match(invoiceSidebar, /ChevronDown/);
});

test("quotes and invoices share one document totals component", () => {
    const quoteForm = source("../components/quotes/QuoteCreateSheet.tsx");
    const invoiceSidebar = source("../components/invoices/InvoiceCreateSheetSidebar.tsx");

    assert.match(quoteForm, /DocumentSummary/);
    assert.match(invoiceSidebar, /DocumentSummary/);
    assert.doesNotMatch(quoteForm, /QuoteSummary/);
    assert.doesNotMatch(invoiceSidebar, /InvoiceSummary/);
});

test("document forms keep totals visible and line actions beside their description", () => {
    const quoteForm = source("../components/quotes/QuoteCreateSheet.tsx");
    const invoiceSidebar = source("../components/invoices/InvoiceCreateSheetSidebar.tsx");
    const sharedShell = source("../components/billing/DocumentFormDialog.tsx");
    const quoteItems = source("../components/quotes/QuoteItemsTable.tsx");
    const invoiceItems = source("../components/invoices/InvoiceConceptsTable.tsx");

    assert.match(quoteForm, /DocumentFormDialog/);
    assert.match(sharedShell, /lg:sticky/);
    assert.match(sharedShell, /max-w-\[1280px\]/);

    for (const itemsSource of [quoteItems, invoiceItems]) {
        assert.match(itemsSource, /handleDuplicateRow/);
        assert.match(itemsSource, /btn-secondary/);
        assert.match(itemsSource, /colSpan=\{4\}/);
        assert.doesNotMatch(itemsSource, /<th className="py-2\.5 px-2 w-10"><\/th>/);
    }
});
