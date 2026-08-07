import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function source(path: string): string {
    return readFileSync(new URL(path, import.meta.url), "utf8");
}

test("invoice list, jobs, quotes, and analytics use solid billing blocks without changing chart plot fill", () => {
    const globals = source("../app/globals.css");
    const invoicesList = source("../components/invoices/InvoicesListSection.tsx");
    const invoicesStats = source("../components/invoices/InvoicesStatsCards.tsx");
    const jobs = source("../components/invoices/InvoiceableJobsSection.tsx");
    const quotesFilters = source("../components/quotes/QuotesFiltersSection.tsx");
    const quotesList = source("../components/quotes/QuotesListSection.tsx");
    const analytics = source("../app/dashboard/analytics/page.tsx");
    const chart = source("../components/dashboard/InteractiveLineChart.tsx");

    assert.match(globals, /\.billing-block\s*\{\s*background-color: var\(--bg-tertiary\);/);

    assert.match(invoicesStats, /billing-block/);
    assert.match(invoicesList, /DataListTable/);
    assert.match(invoicesList, /Pulsa una fila para abrir/);
    assert.doesNotMatch(invoicesList, /ChevronRight/);
    assert.match(invoicesList, /Vence /);

    assert.match(jobs, /billing-block/);
    assert.match(jobs, /billing-surface/);
    assert.match(jobs, /aria-pressed/);
    assert.doesNotMatch(jobs, /from "@\/components\/ui\/table"/);

    assert.match(quotesFilters, /billing-surface/);
    assert.match(quotesFilters, /bg-\[var\(--bg-card-solid\)\]/);
    assert.match(quotesList, /DataListTable/);
    assert.match(quotesList, /Presupuestos registrados/);

    assert.match(analytics, /billing-block/);
    assert.match(analytics, /billing-surface/);
    assert.match(analytics, /Chart plot background stays on InteractiveLineChart/);

    // Keep the plot fill as a light neutral so chart lines stay readable.
    assert.match(
        chart,
        /bg-\[color-mix\(in_srgb,var\(--bg-secondary\)_98%,var\(--text-main\)_2%\)\]/,
    );
});
