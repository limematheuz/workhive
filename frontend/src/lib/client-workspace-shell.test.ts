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
const clientOpportunities = readFileSync(new URL("../components/clients/ClientOpportunitiesTab.tsx", import.meta.url), "utf8");
const clientOpportunityTimeline = readFileSync(new URL("../components/clients/ClientOpportunityTimelineDialog.tsx", import.meta.url), "utf8");
const clientDateTimePicker = readFileSync(new URL("../components/ui/date-time-picker.tsx", import.meta.url), "utf8");
const createClientSheet = readFileSync(new URL("../components/clients/CreateClientSheet.tsx", import.meta.url), "utf8");
const editClientSheet = readFileSync(new URL("../components/clients/EditClientSheet.tsx", import.meta.url), "utf8");
const clientLocations = readFileSync(new URL("../components/clients/ClientDetailLocationsTab.tsx", import.meta.url), "utf8");
const clientTasks = readFileSync(new URL("../components/clients/ClientDetailTasksTab.tsx", import.meta.url), "utf8");
const clientBilling = readFileSync(new URL("../components/clients/ClientDetailBillingTab.tsx", import.meta.url), "utf8");
const clientHeader = readFileSync(new URL("../components/clients/ClientDetailDialogHeader.tsx", import.meta.url), "utf8");
const actionPopover = readFileSync(new URL("../components/ui/action-popover.tsx", import.meta.url), "utf8");
const dropdownMenu = readFileSync(new URL("../components/ui/dropdown-menu.tsx", import.meta.url), "utf8");

test("client workspace uses shared surfaces and keeps all API reads in services", () => {
    assert.match(page, /ClientWorkspaceStats/);
    assert.match(page, /ClientWorkspaceFilters/);
    assert.match(page, /ClientWorkspaceExportButton/);
    assert.match(page, /ClientService\.getClients/);
    assert.match(page, /LocationService\.getLocations\(\)\.catch/);
    assert.match(page, /TaskService\.getAllTaskItems\(\)\.catch/);
    assert.doesNotMatch(page, /fetch\s*\(/);
    assert.match(table, /DataListTable/);
    assert.match(table, /renderCompactRow/);
    assert.match(table, /desktopFrom="lg"/);
    assert.match(table, /DataTablePagination/);
});

test("client detail keeps a wide summary before edit and uses the shared tab control", () => {
    assert.match(detail, /sm:max-w-\[86rem\]/);
    assert.match(detail, /ClientDetailDialogHeader/);
    assert.match(tabs, /PremiumTabs/);
    assert.match(tabs, /compactLabel/);
    assert.doesNotMatch(tabs, /overflow-x-auto|layout="scroll"/);
    assert.match(tabs, /workspace\.overview/);
    assert.match(tabs, /workspace\.locations/);
    assert.match(tabs, /workspace\.jobs/);
});

test("client detail keeps one close action and its action menu appears over the dialog", () => {
    assert.doesNotMatch(clientHeader, /ArrowLeft|Detalle del Cliente/);
    assert.match(clientHeader, /ActionPopover/);
    assert.match(clientHeader, /relationship_status === "lead"/);
    assert.match(actionPopover, /DropdownMenuTrigger/);
    assert.match(dropdownMenu, /z-\[10110\]/);
});

test("every client data table uses the shared responsive list and pagination", () => {
    for (const [name, source] of [["locations", clientLocations], ["tasks", clientTasks], ["billing", clientBilling], ["overview", overview]] as const) {
        assert.match(source, /DataListTable/, `${name} should use the shared responsive table`);
        assert.match(source, /renderCompactRow/, `${name} should render a compact mobile row`);
        assert.match(source, /DataTablePagination/, `${name} should use the shared table paginator`);
    }
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
    assert.match(overview, /ClientContactsTab/);
    assert.match(clientContacts, /ClientService\.getClientContacts/);
    assert.match(clientContacts, /ClientService\.createClientContact/);
    assert.match(clientContacts, /ClientService\.updateClientContact/);
    assert.match(clientContacts, /ClientService\.deactivateClientContact/);
    assert.match(clientContacts, /DeleteConfirmDialog/);
    assert.match(clientContacts, /Checkbox/);
    assert.doesNotMatch(clientContacts, /fetch\s*\(/);
});

test("commercial opportunities remain in the client detail and use shadcn controls", () => {
    assert.match(tabs, /ClientOpportunitiesTab/);
    assert.match(clientOpportunities, /ClientService\.getClientOpportunities/);
    assert.match(clientOpportunities, /ClientService\.createClientOpportunity/);
    assert.match(clientOpportunities, /ClientService\.updateClientOpportunity/);
    assert.match(clientOpportunities, /SelectTrigger/);
    assert.match(clientOpportunities, /DateTimePicker/);
    assert.doesNotMatch(clientOpportunities, /datetime-local/);
    assert.match(clientDateTimePicker, /Calendar/);
    assert.match(clientDateTimePicker, /SelectTrigger/);
    assert.match(clientDateTimePicker, /rounded-xl/);
    assert.match(clientDateTimePicker, /formControlSurfaceClassName/);
    assert.match(clientOpportunityTimeline, /ClientService\.getClientOpportunityActivities/);
    assert.match(clientOpportunityTimeline, /ClientService\.createClientOpportunityActivity/);
    assert.match(clientOpportunityTimeline, /Textarea/);
    assert.doesNotMatch(clientOpportunities, /fetch\s*\(/);
    assert.doesNotMatch(clientOpportunityTimeline, /fetch\s*\(/);
});

test("client dialogs keep their chrome translucent and reuse the shared form surfaces", () => {
    assert.match(clientForm, /formControlSurfaceClassName/);
    assert.doesNotMatch(createClientSheet, /dialog-glass-chrome/);
    assert.doesNotMatch(editClientSheet, /dialog-glass-chrome/);
    assert.doesNotMatch(clientOpportunities, /dialog-glass-chrome/);
    assert.doesNotMatch(clientOpportunityTimeline, /dialog-glass-chrome/);
});

test("client workspace keeps dark search placeholders and only shows data-backed percent badges", () => {
    assert.match(clientFilters, /placeholder:text-\[var\(--text-muted\)\]/);
    assert.match(clientStats, /SummaryMetricCard/);
    assert.match(clientStats, /SummaryMetricGrid/);
    assert.match(overview, /SummaryMetricGrid/);
    assert.doesNotMatch(clientStats, /percentageOf|PercentageBadge/);
});
