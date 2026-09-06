import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");

test("financial routes and navigation follow explicit finance capabilities", () => {
    const sidebar = source("../components/dashboard/sidebar-nav-config.tsx");
    const quotes = source("../app/dashboard/quotes/page.tsx");
    const invoices = source("../app/dashboard/invoices/page.tsx");
    const expenses = source("../app/dashboard/expenses/page.tsx");
    const invoiceSummary = source("../app/dashboard/invoice-summary/page.tsx");
    const fiscalCalendar = source("../app/dashboard/fiscal-calendar/page.tsx");
    const analytics = source("../app/dashboard/analytics/page.tsx");
    const fiscalSummary = source("../app/dashboard/fiscal-summary/page.tsx");

    assert.match(sidebar, /flags\.canViewFinance[\s\S]*href: "\/dashboard\/quotes"/);
    assert.match(quotes, /const canViewQuotes = canViewFinance\(user\);/);
    assert.match(quotes, /const canManageQuotes = canManageFinance\(user\);/);
    assert.match(invoices, /canViewInvoices/);
    assert.match(invoices, /canManageInvoices/);
    assert.match(expenses, /const canViewExpenses = canViewFinance\(user\)/);
    assert.match(expenses, /const canManageExpenses = canManageFinance\(user\)/);
    assert.match(expenses, /!userLoading && !canViewExpenses\) redirect\("\/dashboard"\)/);
    assert.match(invoiceSummary, /!userLoading && !canViewSummary\) redirect\("\/dashboard"\)/);
    assert.match(fiscalCalendar, /!userLoading && !canManage\) redirect\("\/dashboard"\)/);
    assert.match(analytics, /!userLoading && !canViewAnalytics\) redirect\("\/dashboard"\)/);
    assert.match(fiscalSummary, /!userLoading && !canViewSummary\) redirect\("\/dashboard"\)/);
});
