import assert from "node:assert/strict";
import test from "node:test";
import { canManageQualityLocation, getQualityCreationLocations, getQualityWorkspaceAccess } from "./quality-workspace-access.ts";
import type { QualityWorkspaceAccess } from "../types/quality-access.ts";

function payload(sections: Partial<QualityWorkspaceAccess["sections"]>, locations = false): QualityWorkspaceAccess {
    const denied = { can_read: false, can_manage: false, read_locations: [], manage_locations: [] };
    return { sections: { templates: denied, inspections: denied, incidents: denied, complaints: denied, ...sections }, can_read_locations: locations };
}
const reader = { can_read: true, can_manage: false, read_locations: null, manage_locations: [] };

test("quality access fails closed without explicit scopes", () => {
    const result = getQualityWorkspaceAccess(null);
    assert.deepEqual(result.tabs, []);
    assert.equal(result.readLocations, false);
    assert.ok(Object.values(result.manage).every(value => !value));
});
test("incident reading does not grant other sections or location reading", () => {
    const result = getQualityWorkspaceAccess(payload({ incidents: reader }));
    assert.deepEqual(result.tabs.map(tab => tab.id), ["incidents"]);
    assert.equal(result.manage.incidents, false);
    assert.equal(result.readLocations, false);
});
test("management requires reading of that same section", () => {
    const result = getQualityWorkspaceAccess(payload({ incidents: reader, templates: { ...reader, can_read: false, can_manage: true, manage_locations: null } }));
    assert.equal(result.manage.incidents, false);
    assert.equal(result.manage.templates, false);
});
test("mixed quality permissions preserve section order and independent management", () => {
    const result = getQualityWorkspaceAccess(payload({ complaints: reader, templates: { ...reader, can_manage: true, manage_locations: null } }, true));
    assert.deepEqual(result.tabs.map(tab => tab.id), ["templates", "complaints"]);
    assert.equal(result.manage.templates, true);
    assert.equal(result.manage.complaints, false);
    assert.equal(result.readLocations, true);
});
test("company reader with local management can edit only its authorized location", () => {
    const result = getQualityWorkspaceAccess(payload({ incidents: { ...reader, can_manage: true, manage_locations: [15] } }));
    assert.equal(canManageQualityLocation(result, "incidents", 15), true);
    assert.equal(canManageQualityLocation(result, "incidents", 16), false);
    assert.equal(canManageQualityLocation(result, "incidents", null), false);
    assert.deepEqual(getQualityCreationLocations(result, "incidents", [{ id: 16, name: "Otra" }], [16]), [{ id: 15, name: "Ubicación #15" }]);
});
test("local reader with company management remains limited to visible locations", () => {
    const result = getQualityWorkspaceAccess(payload({ templates: { ...reader, can_manage: true, read_locations: [15], manage_locations: null } }));
    assert.equal(canManageQualityLocation(result, "templates", 15), true);
    assert.equal(canManageQualityLocation(result, "templates", 16), false);
    assert.equal(canManageQualityLocation(result, "templates", null), false);
});
test("invalid scope identifiers and unknown scopes fail closed", () => {
    const result = getQualityWorkspaceAccess(payload({ incidents: { ...reader, can_manage: true, read_locations: [-1, 0, 15, 15, 1.5], manage_locations: [16] } }));
    assert.deepEqual(result.readScopes.incidents, [15]);
    assert.equal(result.manage.incidents, false);
});
