import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");

test("shared PageHeader uses squarish brand icon well", () => {
    const header = read("../components/ui/page-header.tsx");
    assert.match(header, /rounded-md/);
    assert.match(header, /brand-blue-border/);
    assert.match(header, /brand-blue-soft/);
    assert.match(header, /text-xl font-bold/);
    assert.doesNotMatch(header, /rounded-full|rounded-2xl|rounded-3xl/);
});

test("dashboard page headers use shared PageHeader", () => {
    const pages = [
        "../app/dashboard/tasks/page.tsx",
        "../app/dashboard/clients/page.tsx",
        "../app/dashboard/locations/page.tsx",
        "../app/dashboard/users/page.tsx",
        "../app/dashboard/roles/page.tsx",
        "../app/dashboard/companies/page.tsx",
        "../app/dashboard/quotes/page.tsx",
        "../app/dashboard/live-work/page.tsx",
        "../app/dashboard/expenses/page.tsx",
        "../app/dashboard/task-reports/page.tsx",
        "../app/dashboard/analytics/page.tsx",
        "../app/dashboard/fiscal-summary/page.tsx",
        "../components/dashboard/superadmin/SuperadminDashboard.tsx",
        "../components/invoices/InvoicesPageHeader.tsx",
        "../features/reservations/ReservationsPageHeader.tsx",
        "../components/calendar/CalendarHeader.tsx",
        "../components/integrations/PlatformCalendarOverview.tsx",
        "../components/dashboard/OperationsCalendar.tsx",
        "../components/dashboard/TechDashboard.tsx",
    ];

    for (const path of pages) {
        const source = read(path);
        assert.match(source, /PageHeader/, `${path} should use PageHeader`);
    }

    const overview = read("../components/integrations/PlatformCalendarOverview.tsx");
    assert.doesNotMatch(overview, /Button asChild className="rounded-full"/);
    assert.match(overview, /<Button asChild>/);
});
