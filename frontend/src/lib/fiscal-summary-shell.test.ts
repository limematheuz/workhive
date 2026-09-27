import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");

test("fiscal summary uses the shared data-list architecture and server-side source", () => {
    const page = read("../app/dashboard/fiscal-summary/page.tsx");
    const service = read("../services/fiscal-summary.service.ts");

    assert.match(page, /PageHeader/);
    assert.match(page, /DataListTable/);
    assert.match(page, /canViewFinance\(user\) && !isPlatformSuperadmin\(user\)/);
    assert.match(page, /FiscalSummaryService\.getSummary/);
    assert.match(page, /from "@\/components\/ui\/select"/);
    assert.match(page, /<SelectTrigger aria-label=\{text\.year\}/);
    assert.doesNotMatch(page, /<select/);
    assert.doesNotMatch(page, /InvoiceService|getAllInvoices|ExpenseService|getAllExpenses/);
    assert.match(service, /assertApiResponseOk/);
    assert.match(service, /\/api\/v1\/fiscal-summary/);
});
