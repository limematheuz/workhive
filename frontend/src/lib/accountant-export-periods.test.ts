import assert from "node:assert/strict";
import test from "node:test";

import { accountantExportFilename, accountantExportPath } from "./accountant-export.ts";

test("accountant exports support monthly, quarterly, semester, and annual periods", () => {
    assert.equal(accountantExportFilename(2026, "month", 2), "workhive-gestoria-2026-02.zip");
    assert.equal(accountantExportFilename(2026, "quarter", 3), "workhive-gestoria-2026-T3.zip");
    assert.equal(accountantExportFilename(2026, "semester", 2), "workhive-gestoria-2026-S2.zip");
    assert.equal(accountantExportFilename(2026, "year"), "workhive-gestoria-2026.zip");
    assert.equal(
        accountantExportPath(2026, "month", 2),
        "/api/v1/accounting-exports/accountant?year=2026&period=month&period_number=2",
    );
    assert.throws(() => accountantExportPath(2026, "quarter", 5));
});
