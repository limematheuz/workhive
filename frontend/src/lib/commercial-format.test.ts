import assert from "node:assert/strict";
import test from "node:test";
import { commercialDate, commercialFollowUpPending, commercialLocalInput } from "./commercial-format.ts";
test("commercial timestamps preserve UTC and explicit offsets", () => {
    assert.equal(commercialDate("2026-11-17T09:30:00")?.toISOString(), "2026-11-17T09:30:00.000Z");
    assert.equal(commercialDate("2026-11-17T10:30:00+01:00")?.toISOString(), "2026-11-17T09:30:00.000Z");
    assert.equal(commercialDate("invalid"), null);
    assert.equal(commercialDate(null), null);
});
test("follow-up attention includes open unscheduled or overdue opportunities and excludes closed ones", () => {
    const now = Date.parse("2026-11-17T12:00:00Z");
    assert.equal(commercialFollowUpPending("new", null, now), true);
    assert.equal(commercialFollowUpPending("qualified", "2026-11-17T11:00:00Z", now), true);
    assert.equal(commercialFollowUpPending("proposal", "2026-11-18T10:00:00Z", now), false);
    assert.equal(commercialFollowUpPending("won", null, now), false);
    assert.equal(commercialFollowUpPending("lost", "2026-11-16T10:00:00Z", now), false);
});
test("editing follow-up times round trips through browser local time", () => {
    const original = "2026-11-17T09:30:00Z";
    assert.equal(new Date(commercialLocalInput(original)).toISOString(), commercialDate(original)?.toISOString());
    assert.equal(commercialLocalInput(null), "");
});
