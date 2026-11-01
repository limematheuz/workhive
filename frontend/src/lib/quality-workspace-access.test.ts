import assert from "node:assert/strict";
import test from "node:test";
import { getQualityWorkspaceAccess } from "./quality-workspace-access.ts";

test("quality access fails closed without explicit capabilities", () => {
    const result = getQualityWorkspaceAccess({});
    assert.deepEqual(result.tabs, []);
    assert.equal(result.readLocations, false);
    assert.ok(Object.values(result.manage).every(value => !value));
});

test("incident reading does not grant other sections or location reading", () => {
    const result = getQualityWorkspaceAccess({ "quality.incidents.read": true });
    assert.deepEqual(result.tabs.map(tab => tab.id), ["incidents"]);
    assert.equal(result.manage.incidents, false);
    assert.equal(result.readLocations, false);
});

test("management requires reading of that same section", () => {
    const result = getQualityWorkspaceAccess({ "quality.incidents.read": true, "quality.templates.manage": true });
    assert.equal(result.manage.incidents, false);
    assert.equal(result.manage.templates, false);
});

test("mixed quality permissions preserve section order and independent management", () => {
    const result = getQualityWorkspaceAccess({ "quality.complaints.read": true, "quality.templates.read": true,
        "quality.templates.manage": true, "locations.read": true });
    assert.deepEqual(result.tabs.map(tab => tab.id), ["templates", "complaints"]);
    assert.equal(result.manage.templates, true);
    assert.equal(result.manage.complaints, false);
    assert.equal(result.readLocations, true);
});
