import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");

test("organization departments use the shared shadcn table and safe management service", () => {
    const panel = source("../components/organization/OrganizationDepartmentsPanel.tsx");
    const service = source("../services/organization.service.ts");

    assert.match(panel, /from "@\/components\/ui\/table"/);
    assert.match(panel, /<TableHeader>/);
    assert.match(panel, /<TableBody>/);
    assert.doesNotMatch(panel, /DataListTable/);
    assert.match(panel, /DeleteConfirmDialog/);
    assert.match(panel, /ActionPopover/);
    assert.match(panel, /<TableHead[^>]*>\{copy\.actions\}<\/TableHead>/);
    assert.match(panel, /usage\.can_delete/);
    assert.match(panel, /wouldCreateDepartmentCycle/);
    assert.match(panel, /UNKNOWN_USAGE/);
    assert.match(panel, /department\.usage \?\? UNKNOWN_USAGE/);
    assert.match(service, /updateDepartment/);
    assert.match(service, /deleteDepartment/);
    assert.match(service, /response\.status === 204/);
    assert.match(service, /usage\?: OrganizationDepartmentUsage/);
});

test("department rows open their editor and keep actions inside the shadcn menu", () => {
    const panel = source("../components/organization/OrganizationDepartmentsPanel.tsx");

    assert.match(panel, /onClick=\{onEdit\}/);
    assert.match(panel, /triggerLabel=\{`\$\{copy\.actions\}: \$\{department\.name\}`\}/);
    assert.match(panel, /variant: "delete"/);
});

test("organization tabs use compact labels instead of mobile horizontal scrolling", () => {
    const controlCenter = source("../components/organization/OrganizationControlCenter.tsx");
    const tabs = source("../components/ui/premium-tabs.tsx");

    assert.match(controlCenter, /layout="fit"/);
    assert.match(controlCenter, /compactLabel: copy\.tabs\.departments_compact/);
    assert.match(tabs, /compactLabel\?: string/);
    assert.doesNotMatch(controlCenter, /layout="scroll"/);
});
