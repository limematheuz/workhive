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
    const expenses = source("../components/expenses/ExpenseSummaryCards.tsx");
    const fiscalSummary = source("../app/dashboard/fiscal-summary/page.tsx");
    const ledgerSummary = source("../app/dashboard/invoice-summary/page.tsx");
    const chart = source("../components/dashboard/InteractiveLineChart.tsx");
    const metricCard = source("../components/ui/summary-metric-card.tsx");

    assert.match(globals, /\.billing-block\s*\{\s*background-color: var\(--bg-tertiary\);/);

    assert.match(invoicesStats, /SummaryMetricCard/);
    assert.match(invoicesList, /from "@\/components\/ui\/table"/);
    assert.match(invoicesList, /<TableHeader>/);
    assert.match(invoicesList, /<TableBody>/);
    assert.match(invoicesList, /Pulsa una fila para abrir/);
    assert.doesNotMatch(invoicesList, /ChevronRight/);
    assert.match(invoicesList, /Vence /);

    assert.match(jobs, /billing-surface/);
    assert.match(jobs, /aria-pressed/);
    assert.match(jobs, /from "@\/components\/ui\/table"/);
    assert.match(jobs, /<TableHeader>/);
    assert.match(jobs, /<TableBody>/);

    assert.match(quotesFilters, /billing-surface/);
    assert.match(quotesFilters, /<SelectTrigger/);
    assert.match(quotesList, /from "@\/components\/ui\/table"/);
    assert.match(quotesList, /<TableHeader>/);
    assert.match(quotesList, /<TableBody>/);
    assert.match(quotesList, /Presupuestos registrados/);

    assert.match(analytics, /billing-block/);
    assert.match(analytics, /billing-surface/);
    assert.match(analytics, /Chart plot background stays on InteractiveLineChart/);
    assert.match(analytics, /color: "var\(--status-active-text\)"/);
    assert.match(analytics, /comparisonDirection/);
    assert.match(analytics, /SummaryMetricCard/);
    assert.match(expenses, /SummaryMetricCard/);
    assert.match(fiscalSummary, /SummaryMetricCard/);
    assert.match(ledgerSummary, /SummaryMetricCard/);
    assert.doesNotMatch(ledgerSummary, /function SummaryMetric\(/);
    assert.match(metricCard, /const TrendIcon = value > 0 \? ArrowUpRight : value < 0 \? ArrowDownRight : Minus/);
    assert.match(metricCard, /size-10 shrink-0 items-center justify-center rounded-xl bg-\[var\(--brand-blue-soft\)\] text-accent/);
    assert.match(globals, /--status-active-text: #047857/);

    // Keep the plot fill as a light neutral so chart lines stay readable.
    assert.match(
        chart,
        /bg-\[color-mix\(in_srgb,var\(--bg-secondary\)_98%,var\(--text-main\)_2%\)\]/,
    );
});
