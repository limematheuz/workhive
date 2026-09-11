import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function source(path: string): string {
    return readFileSync(new URL(path, import.meta.url), "utf8");
}

test("shared DataListTable powers the remaining generic data lists", () => {
    const table = source("../components/ui/data-list-table.tsx");
    const expenses = source("../components/expenses/ExpensesListSection.tsx");
    const profile = source("../components/profile/ProfileHistories.tsx");
    const templates = source("../components/tasks/TasksTemplates.tsx");
    const roles = source("../components/roles/RolesListSection.tsx");
    const integrations = source("../components/integrations/PlatformCalendarOverview.tsx");
    const traffic = source("../components/traffic/TrafficEventsTable.tsx");

    assert.match(table, /export function DataListTable/);
    assert.match(table, /export function DataListRow/);
    assert.match(table, /from "@\/components\/ui\/card"/);
    assert.match(table, /<Card/);
    assert.match(table, /from "@\/components\/ui\/table"/);
    assert.match(table, /<TableHeader>/);
    assert.match(table, /<TableBody>/);
    assert.match(table, /<Table\b/);
    assert.match(table, /Array\.isArray\(node\)/);
    assert.match(table, /variant\?: "surface" \| "plain"/);
    assert.match(table, /renderCompactRow/);
    assert.match(table, /footer\?: ReactNode/);
    assert.match(table, /DataTablePagination/);
    assert.doesNotMatch(table, /!grid/);

    for (const [name, file] of [
        ["expenses", expenses],
        ["templates", templates],
        ["roles", roles],
        ["traffic", traffic],
    ] as const) {
        assert.match(file, /DataListTable/, `${name} should use DataListTable`);
        assert.doesNotMatch(file, /from "@\/components\/ui\/table"/, `${name} should not use legacy Table`);
        assert.doesNotMatch(file, /ChevronRight/, `${name} should not keep chevron affordance`);
    }

    assert.match(profile, /DataListTable/);
    assert.match(profile, /DataListRow/);
    assert.match(profile, /variant="plain"/);
    assert.doesNotMatch(profile, /<table className="w-full text-left border-collapse">/);

    assert.match(templates, /ActionPopover/);
    assert.match(templates, /toolbar=/);
    assert.doesNotMatch(templates, /surface-glass-card/);
    assert.doesNotMatch(templates, /<table className="w-full text-left border-collapse/);

    assert.match(integrations, /DataListTable/);
    assert.doesNotMatch(integrations, /surface-glass-card/);
});

test("the shared table keeps rounded borders and low-contrast row separators", () => {
    const table = source("../components/ui/table.tsx");
    const dataList = source("../components/ui/data-list-table.tsx");

    assert.match(dataList, /overflow-hidden rounded-2xl border border-\[color-mix\(in_srgb,var\(--border-color\)_32%,transparent\)\]/);
    assert.match(table, /border-b border-\[var\(--table-divider\)\] transition-colors hover:!bg-muted\/50/);
    assert.match(table, /--table-divider:color-mix\(in_srgb,var\(--border-color\)_12%,transparent\)/);
});

test("invoice and quote lists use the shared shadcn table primitive", () => {
    const invoices = source("../components/invoices/InvoicesListSection.tsx");
    const quotes = source("../components/quotes/QuotesListSection.tsx");
    const jobs = source("../components/invoices/InvoiceableJobsSection.tsx");
    const companies = source("../components/companies/CompaniesListSection.tsx");
    const clients = source("../components/clients/ClientsTable.tsx");

    for (const [name, file] of [["invoices", invoices], ["quotes", quotes], ["invoiceable jobs", jobs], ["companies", companies]] as const) {
        assert.match(file, /from "@\/components\/ui\/table"/, `${name} should use the local shadcn Table`);
        assert.match(file, /<TableHeader>/, `${name} should render a TableHeader`);
        assert.match(file, /<TableBody>/, `${name} should render a TableBody`);
        assert.doesNotMatch(file, /DataListTable/, `${name} should not use the generic list table`);
    }

    assert.match(clients, /from "@\/components\/ui\/table"/);
    assert.match(clients, /from "@\/components\/ui\/card"/);
    assert.match(clients, /<TableHeader>/);
    assert.doesNotMatch(clients, /DataListTable/);

    assert.match(jobs, /from "@\/components\/ui\/card"/);
    assert.match(jobs, /from "@\/components\/ui\/checkbox"/);
    assert.match(jobs, /function JobMobileCard/);
    assert.match(jobs, /<Checkbox/);
    assert.match(jobs, /grid gap-2\.5 p-3 lg:hidden/);
    assert.doesNotMatch(jobs, /CheckSquare/);
});

test("invoice and quote lists paginate both desktop tables and mobile cards consistently", () => {
    const invoices = source("../components/invoices/InvoicesListSection.tsx");
    const quotes = source("../components/quotes/QuotesListSection.tsx");

    for (const [name, file, collection] of [["invoices", invoices, "invoices"], ["quotes", quotes, "quotes"]] as const) {
        assert.match(file, /DataTablePagination/);
        assert.match(file, new RegExp(`useDataTablePagination\\(${collection}, 10\\)`));
        assert.match(file, /pagination\.pageItems\.map/);
        assert.match(file, /<TableRow/, `${name} should use the shared row separator`);
        assert.match(file, /text-\[var\(--btn-secondary-text\)\]/, `${name} should use the shared blue table headings`);
    }

    assert.match(quotes, /hidden xl:block/);
    assert.match(quotes, /xl:hidden/);
    assert.doesNotMatch(quotes, /overflow-x-auto p-3/);
    assert.doesNotMatch(quotes, /min-w-\[820px\]/);
});
