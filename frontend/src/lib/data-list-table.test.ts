import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function source(path: string): string {
    return readFileSync(new URL(path, import.meta.url), "utf8");
}

test("shared DataListTable powers invoice, quote, client, expense, user, profile, service catalog, roles, companies and traffic lists", () => {
    const table = source("../components/ui/data-list-table.tsx");
    const invoices = source("../components/invoices/InvoicesListSection.tsx");
    const quotes = source("../components/quotes/QuotesListSection.tsx");
    const clients = source("../components/clients/ClientsTable.tsx");
    const expenses = source("../components/expenses/ExpensesListSection.tsx");
    const users = source("../components/users/TeamListSection.tsx");
    const profile = source("../components/profile/ProfileHistories.tsx");
    const templates = source("../components/tasks/TasksTemplates.tsx");
    const roles = source("../components/roles/RolesListSection.tsx");
    const companies = source("../components/companies/CompaniesListSection.tsx");
    const integrations = source("../components/integrations/PlatformCalendarOverview.tsx");
    const traffic = source("../components/traffic/TrafficEventsTable.tsx");

    assert.match(table, /export function DataListTable/);
    assert.match(table, /export function DataListRow/);
    assert.match(table, /billing-block/);
    assert.match(table, /variant\?: "surface" \| "plain"/);

    for (const [name, file] of [
        ["invoices", invoices],
        ["quotes", quotes],
        ["clients", clients],
        ["expenses", expenses],
        ["users", users],
        ["templates", templates],
        ["roles", roles],
        ["companies", companies],
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
