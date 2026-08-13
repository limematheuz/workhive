import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");

test("invoice summary reuses the shared dashboard table and preserves financial boundaries", () => {
    const page = read("../app/dashboard/invoice-summary/page.tsx");
    const sidebar = read("../components/dashboard/sidebar-nav-config.tsx");

    assert.match(page, /DataListTable/);
    assert.match(page, /PageHeader/);
    assert.match(page, /canAdministerCompany\(user\) && !isPlatformSuperadmin\(user\)/);
    assert.match(page, /buildInvoiceSummaryRows/);
    assert.match(page, /summarizeInvoiceSummaryRows/);
    assert.match(page, /buildInvoiceSummaryCsv/);
    assert.match(page, /INVOICE_SUMMARY_CSV_TEMPLATE/);
    assert.match(page, /grid-cols-\[minmax\(7\.5rem/);
    assert.doesNotMatch(page, /ledger_payment_method/);
    assert.doesNotMatch(page, /InvoiceCreateSheet|InvoiceSummaryCsvImportDialog|DeleteConfirmDialog|deleteInvoiceDraft/);
    assert.doesNotMatch(page, /onRowClick|router\.push|\?edit=true/);
    assert.doesNotMatch(page, /coste|margen|profit/i);
    assert.doesNotMatch(page, /console\.error/);
    assert.match(sidebar, /\/dashboard\/invoice-summary/);
});
