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

test("optional document fields are disclosed progressively with shadcn collapsible", () => {
    const quoteForm = source("../components/quotes/QuoteCreateSheet.tsx");
    const quoteAdvanced = source("../components/quotes/QuoteFormAdvancedSection.tsx");
    const invoiceForm = source("../components/invoices/InvoiceCreateSheetDetails.tsx");
    const invoiceSidebar = source("../components/invoices/InvoiceCreateSheetSidebar.tsx");
    const sharedSection = source("../components/billing/DocumentFormSection.tsx");
    const advancedPanel = source("../components/billing/DocumentFormAdvancedPanel.tsx");

    assert.match(quoteForm, /QuoteFormAdvancedSection/);
    assert.match(quoteAdvanced, /DocumentFormAdvancedPanel/);
    assert.match(quoteAdvanced, /Opciones avanzadas/);
    assert.match(invoiceForm, /DocumentFormAdvancedPanel/);
    assert.match(invoiceForm, /Datos adicionales/);
    assert.match(invoiceSidebar, /DocumentFormAdvancedPanel/);
    assert.match(invoiceSidebar, /Firma opcional/);
    assert.match(sharedSection, /billing-surface/);
    assert.match(sharedSection, /rounded-\[24px\]/);
    assert.match(advancedPanel, /Collapsible/);
    assert.match(advancedPanel, /ChevronDown/);
});

test("quotes and invoices share one document totals component", () => {
    const quoteForm = source("../components/quotes/QuoteCreateSheet.tsx");
    const invoiceSidebar = source("../components/invoices/InvoiceCreateSheetSidebar.tsx");

    assert.match(quoteForm, /DocumentSummary/);
    assert.match(invoiceSidebar, /DocumentSummary/);
    assert.doesNotMatch(quoteForm, /QuoteSummary/);
    assert.doesNotMatch(invoiceSidebar, /InvoiceSummary/);
});

test("document form dialog overrides sm:max-w-lg and uses container layout", () => {
    const quoteForm = source("../components/quotes/QuoteCreateSheet.tsx");
    const sharedShell = source("../components/billing/DocumentFormDialog.tsx");
    const quoteItems = source("../components/quotes/QuoteItemsTable.tsx");
    const invoiceItems = source("../components/invoices/InvoiceConceptsTable.tsx");
    const summary = source("../components/billing/DocumentSummary.tsx");
    const details = source("../components/quotes/QuoteFormDetailsSection.tsx");
    const lines = source("../components/quotes/QuoteFormLinesSection.tsx");

    assert.match(quoteForm, /DocumentFormDialog/);
    assert.match(quoteForm, /QuoteFormDetailsSection/);
    assert.match(quoteForm, /QuoteFormLinesSection/);
    assert.match(quoteForm, /QuoteFormAdvancedSection/);
    assert.match(details, /DocumentFormInput/);
    assert.match(lines, /QuoteItemsTable/);
    assert.match(quoteForm, /dict\.quotes\?\.summary_title/);
    assert.match(summary, /title\?:/);
    assert.match(sharedShell, /sm:max-w-\[min\(1280px/);
    assert.match(sharedShell, /@container/);
    assert.match(sharedShell, /@\[48rem\]:grid-cols-/);
    assert.match(sharedShell, /flex flex-none flex-col-reverse/);
    assert.match(sharedShell, /border-t border-\[var\(--border-soft\)\]/);
    assert.match(sharedShell, /overflow-y-auto/);
    assert.match(sharedShell, /footerStart/);

    for (const itemsSource of [quoteItems, invoiceItems]) {
        assert.match(itemsSource, /handleDuplicateRow/);
        assert.match(itemsSource, /variant=\"secondary\"/);
        assert.match(itemsSource, /border-dashed/);
        assert.match(itemsSource, /colSpan=\{4\}/);
        assert.doesNotMatch(itemsSource, /<th className="py-2\.5 px-2 w-10"><\/th>/);
    }
});

test("expense create and edit share DocumentFormDialog shell with fixed footer actions", () => {
    const expenseForm = source("../components/expenses/ExpenseFormDialog.tsx");
    const expensesPage = source("../app/dashboard/expenses/page.tsx");
    const sharedShell = source("../components/billing/DocumentFormDialog.tsx");

    assert.match(expensesPage, /ExpenseFormDialog/);
    assert.match(expenseForm, /DocumentFormDialog/);
    assert.match(expenseForm, /DocumentFormSection/);
    assert.match(expenseForm, /DocumentFormField/);
    assert.match(expenseForm, /DocumentFormInput/);
    assert.match(expenseForm, /from "@\/components\/ui\/checkbox"/);
    assert.match(expenseForm, /footerStart=\{footerExtra\}/);
    assert.match(expenseForm, /keep_adding/);
    assert.match(expenseForm, /editing \? text\.edit_expense : text\.new_expense/);
    assert.match(expenseForm, /editing \? text\.save_changes : text\.add_expense/);
    assert.doesNotMatch(expenseForm, /expense-input/);
    assert.doesNotMatch(expenseForm, /overflow-y-auto/);
    assert.match(sharedShell, /footerStart\?: ReactNode/);
    assert.match(sharedShell, /contentClassName\?: string/);
});
