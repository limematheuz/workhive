import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
    accountantExportFilename,
    accountantExportPath,
    accountantExportYears,
} from "./accountant-export.ts";

test("accountant export uses a stable, descriptive download filename", () => {
    assert.equal(accountantExportFilename(2026), "workhive-gestoria-2026.zip");
});

test("accountant export years are newest first and never precede the API boundary", () => {
    assert.deepEqual(accountantExportYears(2026, 3), [2026, 2025, 2024]);
    assert.deepEqual(accountantExportYears(2001, 5), [2001, 2000]);
});

test("accountant export accepts only the backend year boundary", () => {
    assert.equal(
        accountantExportPath(2026),
        "/api/v1/accounting-exports/accountant?year=2026&period=year",
    );
    assert.throws(() => accountantExportPath(1999), /invalid/);
    assert.throws(() => accountantExportPath(2101), /invalid/);
    assert.throws(() => accountantExportPath(2026.5), /invalid/);
});

test("accountant export controls sit below the finance tab with the shared primary action", () => {
    const page = readFileSync(
        new URL("../app/dashboard/analytics/page.tsx", import.meta.url),
        "utf8",
    );

    assert.match(page, /actions=\{\(\s*<PremiumTabs/);
    assert.match(page, /justify-end gap-2/);
    assert.match(page, /className=\{PAGE_ACTION_BUTTON_PRIMARY\}/);
});
