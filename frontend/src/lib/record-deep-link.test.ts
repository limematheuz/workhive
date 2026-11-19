import assert from "node:assert/strict";
import test from "node:test";
import { incidentFilter, linkedRecordTarget, matchesIncidentFilter, recordLinkUrl } from "./record-deep-link.ts";

test("record links reject ambiguous, missing and unsafe identifiers", () => {
    assert.deepEqual(linkedRecordTarget(new URLSearchParams(), "employeeId"), { present: false, id: null, error: null });
    assert.equal(linkedRecordTarget(new URLSearchParams("employeeId=42"), "employeeId").id, 42);
    for (const value of ["", "0", "-1", "2.5", "01", "Infinity", "9007199254740992", "1&employeeId=2", "../secret"]) {
        const target = linkedRecordTarget(new URLSearchParams("employeeId=" + value), "employeeId");
        assert.equal(target.present, true);
        assert.equal(target.id, null, value);
        assert.ok(target.error);
    }
});

test("closing or changing a record preserves all filters and only replaces its selection", () => {
    const initial = new URLSearchParams("tab=incidents&status=active&q=Centro&incidentId=41&sort=date");
    const changed = new URL("https://test.invalid" + recordLinkUrl("/dashboard/quality", initial, { incidentId: 42 }));
    assert.equal(changed.searchParams.get("status"), "active");
    assert.equal(changed.searchParams.get("incidentId"), "42");
    const closed = new URL("https://test.invalid" + recordLinkUrl(changed.pathname, changed.searchParams, { incidentId: null }));
    assert.equal(closed.searchParams.has("incidentId"), false);
    assert.equal(closed.searchParams.get("q"), "Centro");
    assert.equal(closed.searchParams.get("sort"), "date");
    assert.equal(initial.get("incidentId"), "41");
});

test("active incidents include both pending states and exclude resolved or closed records", () => {
    const filter = incidentFilter(new URLSearchParams("status=active"));
    assert.deepEqual(filter, { value: "active", invalid: false });
    assert.equal(matchesIncidentFilter("open", filter.value), true);
    assert.equal(matchesIncidentFilter("in_progress", filter.value), true);
    assert.equal(matchesIncidentFilter("resolved", filter.value), false);
    assert.equal(matchesIncidentFilter("closed", filter.value), false);
    assert.equal(matchesIncidentFilter("closed", "all"), true);
    assert.equal(matchesIncidentFilter("in_progress", "open"), false);
    assert.equal(matchesIncidentFilter("resolved", "resolved"), true);
});

test("unknown or duplicated incident states are marked invalid instead of silently taking one", () => {
    for (const value of ["", "unknown", "open&status=resolved"]) {
        assert.deepEqual(incidentFilter(new URLSearchParams("status=" + value)), { value: "all", invalid: true });
    }
    assert.deepEqual(incidentFilter(new URLSearchParams()), { value: "all", invalid: false });
});
