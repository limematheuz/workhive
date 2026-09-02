import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const page = readFileSync(new URL("../app/dashboard/clients/page.tsx", import.meta.url), "utf8");
const table = readFileSync(new URL("../components/clients/ClientsTable.tsx", import.meta.url), "utf8");
const detail = readFileSync(new URL("../components/clients/ClientDetailDialog.tsx", import.meta.url), "utf8");
const overview = readFileSync(new URL("../components/clients/ClientDetailOverview.tsx", import.meta.url), "utf8");
const tabs = readFileSync(new URL("../components/clients/ClientDetailDialogTabsSection.tsx", import.meta.url), "utf8");
const clientForm = readFileSync(new URL("../components/clients/ClientFormFields.tsx", import.meta.url), "utf8");
const clientFilters = readFileSync(new URL("../components/clients/ClientWorkspaceFilters.tsx", import.meta.url), "utf8");
const clientStats = readFileSync(new URL("../components/clients/ClientWorkspaceStats.tsx", import.meta.url), "utf8");
const clientContacts = readFileSync(new URL("../components/clients/ClientContactsTab.tsx", import.meta.url), "utf8");

test("client workspace uses shared surfaces and keeps all API reads in services", () => {
    assert.match(page, /ClientWorkspaceStats/);
    assert.match(page, /ClientWorkspaceFilters/);
    assert.match(page, /ClientWorkspaceExportButton/);
    assert.match(page, /ClientService\.getClients/);
    assert.match(page, /LocationService\.getLocations\(\)\.catch/);
    assert.match(page, /TaskService\.getAllTaskItems\(\)\.catch/);
    assert.doesNotMatch(page, /fetch\s*\(/);
    assert.match(table, /DataListTable/);
});

test("client detail keeps a wide summary before edit and uses the shared tab control", () => {
    assert.match(detail, /sm:max-w-\[86rem\]/);
    assert.match(detail, /ClientDetailDialogHeader/);
    assert.match(tabs, /PremiumTabs/);
    assert.match(tabs, /workspace\.overview/);
    assert.match(tabs, /workspace\.locations/);
    assert.match(tabs, /workspace\.jobs/);
});

test("client email opens the in-app composer instead of an external mail client", () => {
    assert.match(overview, /DocumentEmailDialog/);
    assert.match(overview, /ClientService\.sendClientEmail/);
    assert.doesNotMatch(overview, /mailto:/);
});

test("client create and edit share every persisted client field", () => {
    assert.match(clientForm, /name="name"/);
    assert.match(clientForm, /name="legal_number"/);
    assert.match(clientForm, /name="email"/);
    assert.match(clientForm, /name="phone"/);
    assert.match(clientForm, /name="address"/);
    assert.match(clientForm, /name="city"/);
    assert.match(clientForm, /name="province"/);
    assert.match(clientForm, /name="postal_code"/);
    assert.match(clientForm, /name="country"/);
    assert.match(clientForm, /id: "company"/);
    assert.match(clientForm, /relationshipStatus/);
    assert.match(clientForm, /SelectTrigger/);
});

test("client lifecycle and contacts use the shared shadcn controls", () => {
    assert.match(clientFilters, /filter_relationship/);
    assert.match(clientFilters, /SelectTrigger/);
    assert.doesNotMatch(clientFilters, /<select/);
    assert.match(tabs, /ClientContactsTab/);
    assert.match(clientContacts, /ClientService\.getClientContacts/);
    assert.match(clientContacts, /ClientService\.createClientContact/);
    assert.match(clientContacts, /ClientService\.updateClientContact/);
    assert.match(clientContacts, /ClientService\.deactivateClientContact/);
    assert.match(clientContacts, /DeleteConfirmDialog/);
    assert.match(clientContacts, /Checkbox/);
    assert.doesNotMatch(clientContacts, /fetch\s*\(/);
});

test("client workspace keeps dark search placeholders and only shows data-backed percent badges", () => {
    assert.match(clientFilters, /placeholder:text-\[var\(--text-muted\)\]/);
    assert.match(clientStats, /SummaryMetricCard/);
    assert.doesNotMatch(clientStats, /percentageOf|PercentageBadge/);
});
