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
    assert.match(panel, /from "@\/components\/ui\/card"/);
    assert.match(panel, /hidden lg:block/);
    assert.match(panel, /grid gap-2\.5 p-3 lg:hidden/);
    assert.match(panel, /function DepartmentCard/);
    assert.match(service, /updateDepartment/);
    assert.match(service, /deleteDepartment/);
    assert.match(service, /response\.status === 204/);
    assert.match(service, /usage\?: OrganizationDepartmentUsage/);
});

test("department rows open their editor and keep actions inside the shadcn menu", () => {
    const panel = source("../components/organization/OrganizationDepartmentsPanel.tsx");

    assert.match(panel, /onClick=\{canManage \? onEdit : undefined\}/);
    assert.match(panel, /useOrganizationPermission\("organization\.departments\.manage"\)/);
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

test("organization creation owns its form and uses the service boundary", () => {
    const controlCenter = source("../components/organization/OrganizationControlCenter.tsx");
    const editor = source("../components/organization/CreateOrganizationDialog.tsx");
    assert.match(controlCenter, /import \{ CreateOrganizationDialog, type CreateKind \}/);
    assert.doesNotMatch(controlCenter, /function CreateOrganizationDialog/);
    assert.match(editor, /OrganizationService\.createDepartment/);
    assert.match(editor, /OrganizationService\.createTeam/);
    assert.match(editor, /OrganizationService\.createPermissionProfile/);
    assert.doesNotMatch(editor, /\bfetch\(/);
    assert.match(editor, /permissionLabel/);
});
