import assert from "node:assert/strict";
import test from "node:test";

import { formatShortDateTime } from "../components/dashboard/tech-task/utils.ts";

test("date-only task detail explains that no hour was selected", () => {
    assert.match(
        formatShortDateTime("2026-10-22T00:00:00.000Z", "es") || "",
        /22 oct.*Sin hora/,
    );
    assert.match(
        formatShortDateTime("2026-10-22T00:00:00+00:00", "en") || "",
        /Oct 22.*No time set/,
    );
});

test("timed task detail preserves the selected hour", () => {
    const value = formatShortDateTime("2026-10-22T09:30:00.000Z", "es");
    assert.ok(value);
    assert.doesNotMatch(value, /Sin hora/);
});
