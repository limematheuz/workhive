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

    assert.match(quoteForm, /Opciones avanzadas/);
    assert.match(invoiceForm, /Datos adicionales/);
    assert.match(invoiceSidebar, /Firma opcional/);
});

test("quotes and invoices share one document totals component", () => {
    const quoteForm = source("../components/quotes/QuoteCreateSheet.tsx");
    const invoiceSidebar = source("../components/invoices/InvoiceCreateSheetSidebar.tsx");

    assert.match(quoteForm, /DocumentSummary/);
    assert.match(invoiceSidebar, /DocumentSummary/);
    assert.doesNotMatch(quoteForm, /QuoteSummary/);
    assert.doesNotMatch(invoiceSidebar, /InvoiceSummary/);
});
