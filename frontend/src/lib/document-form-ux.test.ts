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

test("document tax controls use local shadcn select and checkbox primitives", () => {
    const summary = source("../components/billing/DocumentSummary.tsx");
    const selectors = source("../components/billing/BillingSelectors.tsx");

    assert.match(summary, /from "@\/components\/ui\/checkbox"/);
    assert.match(summary, /from "@\/components\/ui\/label"/);
    assert.match(summary, /htmlFor="document-prices-include-tax"/);
    assert.match(selectors, /from "@\/components\/ui\/select"/);
    assert.match(selectors, /<SelectTrigger/);
    assert.doesNotMatch(selectors, /<select/);
});

test("quote and invoice form controls use the local shadcn primitives", () => {
    const inputSources = [
        source("../components/billing/BillingPartyCard.tsx"),
        source("../components/billing/DocumentSummary.tsx"),
        source("../components/quotes/QuoteItemsTable.tsx"),
        source("../components/invoices/InvoiceConceptsTable.tsx"),
        source("../components/invoices/InvoiceDetailItemsSection.tsx"),
        source("../components/invoices/InvoiceDetailEditModePanel.tsx"),
        source("../components/invoices/InvoiceableJobsSection.tsx"),
    ];
    const selectSources = [
        source("../components/quotes/QuoteFormDetailsSection.tsx"),
        source("../components/invoices/InvoiceCreateSheetDetails.tsx"),
        source("../components/invoices/InvoiceConceptsTable.tsx"),
        source("../components/invoices/InvoiceDetailEditModePanel.tsx"),
        source("../components/invoices/InvoiceableJobsSection.tsx"),
    ];

    for (const formSource of [...inputSources, ...selectSources]) {
        assert.doesNotMatch(formSource, /<(?:input|select)\b/);
    }
    for (const inputSource of inputSources) {
        assert.match(inputSource, /@\/components\/ui\/input/);
    }
    for (const selectSource of selectSources) {
        assert.match(selectSource, /@\/components\/ui\/select/);
        assert.match(selectSource, /<SelectTrigger/);
    }
});

test("local shadcn controls share one WorkHive surface contract", () => {
    const surface = source("../components/ui/control-styles.ts");
    const primitives = [
        source("../components/ui/input.tsx"),
        source("../components/ui/textarea.tsx"),
        source("../components/ui/select.tsx"),
        source("../components/ui/checkbox.tsx"),
    ];

    assert.match(surface, /formControlSurfaceClassName/);
    assert.match(surface, /bg-\[var\(--bg-primary\)\]/);
    assert.match(surface, /focus-visible:ring-2/);
    for (const primitive of primitives) {
        assert.match(primitive, /formControlSurfaceClassName/);
    }
});

test("invoice creation composes editable controls from local shadcn primitives", () => {
    const createDetails = source("../components/invoices/InvoiceCreateSheetDetails.tsx");
    const description = source("../components/invoices/InvoiceConceptDescription.tsx");
    const conceptsTable = source("../components/invoices/InvoiceConceptsTable.tsx");
    const additionalInfo = source("../components/invoices/InvoiceAdditionalInfo.tsx");
    const documentControls = source("../components/billing/DocumentFormControls.tsx");

    assert.match(createDetails, /<DocumentFormInput/);
    assert.match(createDetails, /dialog-compact-control/);
    assert.match(createDetails, /bg-\[var\(--bg-primary\)\]/);
    assert.match(description, /from "@\/components\/ui\/button"/);
    assert.match(description, /from "@\/components\/ui\/input"/);
    assert.match(description, /from "@\/components\/ui\/label"/);
    assert.match(description, /from "@\/components\/ui\/textarea"/);
    assert.doesNotMatch(description, /<(?:input|textarea|button)\b/);
    assert.match(description, /dialog-compact-control/);
    assert.match(conceptsTable, /<Button/);
    assert.doesNotMatch(conceptsTable, /<button\b/);
    assert.doesNotMatch(conceptsTable, /<label\b/);
    assert.match(conceptsTable, /dialog-compact-control/);
    assert.match(additionalInfo, /from "@\/components\/ui\/textarea"/);
    assert.doesNotMatch(additionalInfo, /<textarea\b/);
    assert.match(additionalInfo, /dialog-compact-control/);
    assert.match(documentControls, /from "@\/components\/ui\/textarea"/);
    assert.doesNotMatch(documentControls, /<textarea\b/);
    assert.match(source("../components/billing/BillingPartyCard.tsx"), /partyInputClassName/);
    assert.match(source("../components/billing/BillingPartyCard.tsx"), /from "@\/components\/ui\/button"/);
    assert.match(source("../components/billing/BillingPartyCard.tsx"), /from "@\/components\/ui\/label"/);
    assert.doesNotMatch(source("../components/billing/BillingPartyCard.tsx"), /<(?:button|label)\b/);
    assert.doesNotMatch(source("../components/billing/BillingSelectors.tsx"), /bg-\[var\(--bg-tertiary\)\]/);
});

test("invoice dates use the shared shadcn date picker instead of browser date controls", () => {
    const createDetails = source("../components/invoices/InvoiceCreateSheetDetails.tsx");
    const editPanel = source("../components/invoices/InvoiceDetailEditModePanel.tsx");
    const quoteDetails = source("../components/quotes/QuoteFormDetailsSection.tsx");
    const datePicker = source("../components/ui/date-picker.tsx");

    for (const formSource of [createDetails, editPanel, quoteDetails]) {
        assert.match(formSource, /from "@\/components\/ui\/date-picker"/);
        assert.match(formSource, /<DatePicker/);
        assert.doesNotMatch(formSource, /type="date"/);
    }
    assert.match(datePicker, /<Calendar/);
    assert.match(datePicker, /<Popover/);
    assert.match(datePicker, /<InputGroup/);
    assert.match(datePicker, /bg-\[var\(--bg-primary\)\]/);
    assert.match(datePicker, /<InputGroupInput/);
    assert.match(datePicker, /parseTypedDate/);
});

test("invoice and quote line tables use the shared shadcn table composition", () => {
    const table = source("../components/ui/table.tsx");
    const lineTables = [
        source("../components/invoices/InvoiceConceptsTable.tsx"),
        source("../components/invoices/InvoiceDetailItemsSection.tsx"),
        source("../components/quotes/QuoteItemsTable.tsx"),
        source("../components/quotes/QuoteDetailItems.tsx"),
    ];

    assert.match(table, /function Table/);
    assert.match(table, /function TableHeader/);
    assert.match(table, /function TableBody/);
    assert.match(table, /function TableRow/);
    assert.match(table, /function TableHead/);
    assert.match(table, /function TableCell/);
    for (const lineTable of lineTables) {
        assert.match(lineTable, /from "@\/components\/ui\/table"/);
        assert.match(lineTable, /<TableHeader/);
        assert.match(lineTable, /<TableBody/);
        assert.doesNotMatch(lineTable, /<table\b/);
    }
});

test("quote creation uses the shared shadcn control contract", () => {
    const details = source("../components/quotes/QuoteFormDetailsSection.tsx");
    const items = source("../components/quotes/QuoteItemsTable.tsx");

    assert.match(details, /from "@\/components\/ui\/date-picker"/);
    assert.match(details, /<DatePicker/);
    assert.doesNotMatch(details, /type="date"/);
    assert.doesNotMatch(details, /bg-\[var\(--bg-card-solid\)\]/);
    assert.match(items, /from "@\/components\/ui\/textarea"/);
    assert.match(items, /<Textarea/);
    assert.match(items, /<Button/);
    assert.doesNotMatch(items, /<(?:textarea|button|label)\b/);
});

test("quote list filters and actions use local shadcn controls", () => {
    const filters = source("../components/quotes/QuotesFiltersSection.tsx");
    const list = source("../components/quotes/QuotesListSection.tsx");
    const page = source("../app/dashboard/quotes/page.tsx");

    assert.match(filters, /from "@\/components\/ui\/select"/);
    assert.match(filters, /from "@\/components\/ui\/label"/);
    assert.match(filters, /<SelectTrigger/);
    assert.doesNotMatch(filters, /<(?:select|label)\b/);
    assert.match(list, /from "@\/components\/ui\/button"/);
    assert.doesNotMatch(list, /<button\b/);
    assert.match(page, /from "@\/components\/ui\/button"/);
    assert.doesNotMatch(page, /<button\b/);
});

test("quote detail client registration uses shared shadcn select and buttons", () => {
    const registration = source("../components/quotes/RegisterClientDialog.tsx");

    assert.match(registration, /from "@\/components\/ui\/select"/);
    assert.match(registration, /from "@\/components\/ui\/button"/);
    assert.match(registration, /<SelectTrigger/);
    assert.match(registration, /<Button/);
    assert.doesNotMatch(registration, /<(?:select|button)\b/);
});

test("invoice draft edit mode uses the shared control contract", () => {
    const panel = source("../components/invoices/InvoiceDetailEditModePanel.tsx");
    const items = source("../components/invoices/InvoiceDetailItemsSection.tsx");

    assert.match(panel, /from "@\/components\/ui\/label"/);
    assert.match(panel, /from "@\/components\/ui\/input"/);
    assert.match(panel, /from "@\/components\/ui\/select"/);
    assert.match(panel, /from "@\/components\/ui\/checkbox"/);
    assert.match(panel, /from "@\/components\/ui\/date-picker"/);
    assert.doesNotMatch(panel, /<(?:input|select|label)\b/);
    assert.doesNotMatch(panel, /bg-\[var\(--bg-card-solid\)\]/);
    assert.match(items, /from "@\/components\/ui\/input"/);
    assert.match(items, /<TaxRateSelect/);
});

test("invoice detail edit actions use the local shadcn button", () => {
    const actionBar = source("../components/invoices/InvoiceDetailActionBar.tsx");

    assert.match(actionBar, /from "@\/components\/ui\/button"/);
    assert.match(actionBar, /<Button/);
    assert.doesNotMatch(actionBar, /<button\b/);
});

test("invoice list filters use the shared shadcn input and select controls", () => {
    const filters = source("../components/invoices/InvoicesFiltersBar.tsx");

    assert.match(filters, /from "@\/components\/ui\/input"/);
    assert.match(filters, /from "@\/components\/ui\/select"/);
    assert.match(filters, /<Input/);
    assert.match(filters, /<SelectTrigger/);
    assert.doesNotMatch(filters, /<select\b/);
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
