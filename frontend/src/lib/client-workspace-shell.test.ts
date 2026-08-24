import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const page = readFileSync(new URL("../app/dashboard/clients/page.tsx", import.meta.url), "utf8");
const table = readFileSync(new URL("../components/clients/ClientsTable.tsx", import.meta.url), "utf8");
const detail = readFileSync(new URL("../components/clients/ClientDetailDialog.tsx", import.meta.url), "utf8");
const tabs = readFileSync(new URL("../components/clients/ClientDetailDialogTabsSection.tsx", import.meta.url), "utf8");

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
    assert.match(tabs, /Resumen/);
    assert.match(tabs, /Ubicaciones/);
    assert.match(tabs, /Trabajos/);
});
