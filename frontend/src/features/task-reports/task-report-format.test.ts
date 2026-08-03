import assert from "node:assert/strict";
import test from "node:test";

import { formatTaskReportDate } from "./task-report-format.ts";

test("task report timestamps use the canonical UTC timezone", () => {
    const value = "2026-07-14T23:30:00.000Z";

    assert.equal(
        formatTaskReportDate(value, "en-US", "card"),
        "7/14/26, 11:30 PM",
    );
});

test("task report timestamp formatting is deterministic for each supported style", () => {
    const value = "2026-07-14T23:30:00.000Z";

    assert.match(formatTaskReportDate(value, "es-ES", "detail"), /14 jul 2026/i);
    assert.match(formatTaskReportDate(value, "es-ES", "full"), /lunes/i);
});
