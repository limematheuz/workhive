import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");

test("sales ledger reuses shared UI and keeps issued invoices read-only", () => {
    const page = read("../app/dashboard/invoice-summary/page.tsx");
    const sidebar = read("../components/dashboard/sidebar-nav-config.tsx");

    assert.match(page, /DataListTable/);
    assert.match(page, /PageHeader/);
    assert.match(page, /canViewFinance\(user\) && !isPlatformSuperadmin\(user\)/);
    assert.match(page, /canManageFinance\(user\) && !isPlatformSuperadmin\(user\)/);
    assert.match(page, /SalesLedgerService\.getEntries/);
    assert.match(page, /SalesLedgerRecordDialog/);
    assert.match(page, /SalesLedgerImportDialog/);
    assert.match(page, /buildSalesLedgerCsv/);
    assert.match(page, /SALES_LEDGER_CSV_TEMPLATE/);
    assert.match(page, /entry\.is_editable/);
    assert.match(page, /ledger_invoice_read_only/);
    assert.match(page, /canManage && entry\.is_editable/);
    assert.match(page, /renderLedgerDesktopCells/);
    assert.match(page, /<ReceiptText className="size-4" \/>/);
    assert.doesNotMatch(page, /grid-cols-\[minmax\(7\.5rem/);
    assert.doesNotMatch(page, /InvoiceCreateSheet|deleteInvoiceDraft/);
    assert.doesNotMatch(page, /onRowClick|router\.push|\?edit=true/);
    assert.doesNotMatch(page, /coste|margen|profit/i);
    assert.doesNotMatch(page, /console\.error/);
    assert.match(sidebar, /\/dashboard\/invoice-summary/);
});
