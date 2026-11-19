import assert from "node:assert/strict";
import test from "node:test";
import { advisoryRequestStep, clientQuoteNeedsDecision, partnerRequestPending, portalComplaintUnresolved, portalTextMatches, upcomingPartnerRequests } from "./portal-attention.ts";

test("client decisions require a sent revision that has not expired", () => {
    const now = Date.parse("2026-11-19T12:00:00Z");
    assert.equal(clientQuoteNeedsDecision({ status: "sent", valid_until: null }, now), true);
    assert.equal(clientQuoteNeedsDecision({ status: "sent", valid_until: "2026-11-20T12:00:00" }, now), true);
    assert.equal(clientQuoteNeedsDecision({ status: "sent", valid_until: "2026-11-19T12:00:00Z" }, now), false);
    for (const status of ["accepted", "rejected", "expired", "draft"]) assert.equal(clientQuoteNeedsDecision({ status }, now), false);
    assert.equal(clientQuoteNeedsDecision({ status: "sent", valid_until: "invalid" }, now), false);
});

test("client follow-up priorities exclude resolved and closed complaints", () => {
    for (const status of ["submitted", "in_review"]) assert.equal(portalComplaintUnresolved({ status }), true);
    for (const status of ["resolved", "closed"]) assert.equal(portalComplaintUnresolved({ status }), false);
});

test("upcoming partner requests are chronological, uncompleted and do not mutate source order", () => {
    const rows = [
        { id: 1, check_out_at: "2026-11-23T12:00:00Z", cleaning_status: "requested" },
        { id: 2, check_out_at: "2026-11-20T12:00:00Z", cleaning_status: "scheduled" },
        { id: 3, check_out_at: "2026-11-21T12:00:00Z", cleaning_status: "completed" },
        { id: 4, check_out_at: "2026-11-22T12:00:00Z", cleaning_status: "cancelled" },
        { id: 5, check_out_at: "2026-11-18T12:00:00Z", cleaning_status: "requested" },
    ];
    assert.deepEqual(upcomingPartnerRequests(rows, Date.parse("2026-11-19T12:00:00Z")).map((row) => row.id), [2, 1]);
    assert.deepEqual(rows.map((row) => row.id), [1, 2, 3, 4, 5]);
    assert.equal(rows.filter(partnerRequestPending).length, 3);
});

test("adviser next step comes from response data without inventing due or reviewed states", () => {
    assert.equal(advisoryRequestStep({ response: null }), "company");
    assert.equal(advisoryRequestStep({ response: "Documentación adjunta" }), "response_available");
    assert.equal(portalTextMatches("LOPEZ", [null, "María López"]), true);
    assert.equal(portalTextMatches("Centro Norte", ["Centro Sur"]), false);
});
