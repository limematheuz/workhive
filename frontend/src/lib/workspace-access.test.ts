import assert from "node:assert/strict";
import test from "node:test";
import {navigationCapabilityAllowed as allowed,initialWorkerRouteAllowed} from "../domain/navigation/workspace-access.ts";
test("navigation uses effective company permissions for direct links and detail routes",()=>{
 assert.equal(allowed("/dashboard/invoices/19",{"finance.read":true}),true);assert.equal(allowed("/dashboard/invoices/19",{"work.manage":true}),false);assert.equal(allowed("/dashboard/locations/8",{"locations.read":false}),false);assert.equal(allowed("/dashboard/services",{"work.manage":true}),true);assert.equal(allowed("/dashboard/services",{"work.read":true}),false);assert.equal(allowed("/dashboard/organization",{"organization.departments.read":true}),true);assert.equal(allowed("/dashboard/organization",{}),false);assert.equal(allowed("/dashboard/profile",{}),true);assert.equal(allowed("/dashboard/documents",{"labor_costs.read":true}),true);assert.equal(allowed("/dashboard/plantilla/trabajadores",{"finance.read":true}),false);
});
test("initial workers keep their own operational routes while management workspaces require explicit profiles",()=>{
 assert.equal(initialWorkerRouteAllowed("/worker/jobs",true),true);
 assert.equal(initialWorkerRouteAllowed("/dashboard/tasks",true),true);
 assert.equal(initialWorkerRouteAllowed("/dashboard/work-orders",true),false);
 assert.equal(initialWorkerRouteAllowed("/dashboard/work-orders/18",true),false);
 assert.equal(initialWorkerRouteAllowed("/dashboard/custom-reports",true),false);
 assert.equal(initialWorkerRouteAllowed("/dashboard/work-orders",false),true);
 assert.equal(initialWorkerRouteAllowed("/dashboard/work-orders-unrelated",true),true);
 assert.equal(allowed("/dashboard/documents/centros",{"labor_costs.read":true}),false);
 assert.equal(allowed("/dashboard/documents/centros",{"locations.read":true}),true);
});

test("mixed financial permissions remain conjunctive and own-time views do not require company-time reads",()=>{
 assert.equal(allowed("/dashboard/subcontracts",{"inventory.read":true}),false);
 assert.equal(allowed("/dashboard/subcontracts",{"finance.read":true}),false);
 assert.equal(allowed("/dashboard/subcontracts",{"finance.read":true,"inventory.read":true}),true);
 assert.equal(allowed("/dashboard/inventory",{"inventory.read":true,"work.manage":false}),true);
 assert.equal(allowed("/dashboard/offline-review",{"time.read":true}),false);
 assert.equal(allowed("/dashboard/offline-review",{"time.approve":true}),true);
 assert.equal(allowed("/dashboard/mi-jornada",{"time.manage":true,"time.read":false}),true);
 assert.equal(allowed("/dashboard/time-corrections",{"time.approve":true}),true);
});

test("quality navigation follows authorized sections and denies unrelated capabilities", () => {
 for (const section of ["templates", "inspections", "incidents", "complaints"]) {
  assert.equal(allowed("/dashboard/quality", { [`quality.${section}.read`]: true }), true);
 }
 assert.equal(allowed("/dashboard/quality", {}), false);
 assert.equal(allowed("/dashboard/quality", { "work.read": true, "finance.read": true }), false);
 assert.equal(allowed("/dashboard/quality", { "quality.incidents.read": false }), false);
});
