import assert from "node:assert/strict";
import test from "node:test";
import { isWorkspaceSearchHref, searchResultCount, searchStatusLabel } from "./workspace-search.ts";

test("search opens only local record and module destinations", () => {
    for (const href of ["/dashboard/clients?clientId=21", "/dashboard/invoices/4", "/worker/clock?sessionId=2", "/dashboard/quality?tab=incidents&incidentId=1"]) assert.equal(isWorkspaceSearchHref(href), true, href);
    for (const href of ["https://evil.test/dashboard", "//evil.test", "/\\evil.test", "/api/v1/users", "/dashboard/clients#script", "javascript:alert(1)", "/dashboard/invoices/../roles", "/dashboard/invoices/0"]) assert.equal(isWorkspaceSearchHref(href), false, href);
});

test("search count covers all visible groups and uses recognizable states", () => {
    assert.equal(searchResultCount({ query: "ma", company_id: 1, context_key: "test", available_types: [], navigation: [], groups: [] }), 0);
    assert.equal(searchStatusLabel("in_progress"), "En curso");
    assert.equal(searchStatusLabel("pending_review"), "Pendiente de revisión");
});
