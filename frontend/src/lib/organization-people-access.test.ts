import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const controlCenter = readFileSync(
    new URL("../components/organization/OrganizationControlCenter.tsx", import.meta.url),
    "utf8",
);
const invitationDialog = readFileSync(
    new URL("../components/organization/OrganizationInvitePersonDialog.tsx", import.meta.url),
    "utf8",
);
const teamsPanel = readFileSync(
    new URL("../components/organization/OrganizationTeamsPanel.tsx", import.meta.url),
    "utf8",
);

test("organization people uses the shared shadcn table and keeps anonymous history separate", () => {
    const peopleSection = controlCenter.slice(
        controlCenter.indexOf("function MembersTable"),
        controlCenter.indexOf("function permissionLabel"),
    );

    assert.match(peopleSection, /<TableHeader>/);
    assert.match(peopleSection, /<TableBody>/);
    assert.doesNotMatch(peopleSection, /<Badge variant="outline">\{accessLabel\}/);
    assert.match(peopleSection, /copy\.people\.history_title/);
    assert.match(peopleSection, /member\.ended_at/);
    assert.match(controlCenter, /deleted\+.*invalid\.workhive\.local/);
    assert.doesNotMatch(peopleSection, /<DataListTable/);
    assert.match(peopleSection, /border-b border-\[var\(--border-soft\)\]/);
    assert.match(peopleSection, /copy\.columns\.actions/);
    assert.match(peopleSection, /ActionPopover/);
});

test("organization enables invitations and uses the shared shadcn form primitives", () => {
    assert.match(controlCenter, /people: copy\.actions\.invite_person/);
    assert.match(controlCenter, /void openInvitation\(\)/);
    assert.doesNotMatch(controlCenter, /disabled=\{tab === "people"\}/);
    assert.match(controlCenter, /UserService\.deleteUser/);
    assert.match(invitationDialog, /@\/components\/ui\/dialog/);
    assert.match(invitationDialog, /@\/components\/ui\/input/);
    assert.match(invitationDialog, /@\/components\/ui\/select/);
    assert.match(invitationDialog, /<DialogContent compact className="max-h-\[90dvh\] max-w-xl overflow-y-auto">/);
    assert.doesNotMatch(invitationDialog, /overflow-x-hidden/);
    assert.match(invitationDialog, /UserService\.inviteUser/);
    assert.match(invitationDialog, /useDictionary/);
});

test("organization teams use the shared table while permission profiles expose real, safe actions", () => {
    assert.match(controlCenter, /OrganizationTeamsPanel/);
    assert.doesNotMatch(controlCenter, /function TeamsTable/);
    assert.doesNotMatch(teamsPanel, /DataListTable/);
    assert.match(teamsPanel, /<TableHeader>/);
    assert.match(teamsPanel, /copy\.actions/);
    assert.match(teamsPanel, /ActionPopover/);
    assert.match(teamsPanel, /replaceTeamMembers/);
    assert.match(teamsPanel, /usage\.can_delete/);
    assert.match(teamsPanel, /usage\.can_deactivate/);
    assert.match(teamsPanel, /<DialogContent compact className="max-h-\[90dvh\] max-w-xl overflow-y-auto">/);
    assert.match(teamsPanel, /<DialogContent compact className="max-h-\[90dvh\] max-w-2xl overflow-y-auto">/);
    assert.doesNotMatch(teamsPanel, /overflow-x-hidden/);
    assert.match(teamsPanel, /dict\.organization\.access\[member\.access_class\]/);
    assert.match(controlCenter, /<DialogContent compact className="permission-profile-dialog">/);
    assert.match(controlCenter, /function ProfilesTable/);
    assert.match(controlCenter, /copy\.profiles\.actions/);
    assert.match(controlCenter, /permissionLabel\(/);
    assert.doesNotMatch(controlCenter, /profile\.permission_codes\.join/);
    assert.match(controlCenter, /ActionPopover/);
    assert.match(controlCenter, /OrganizationService\.updatePermissionProfile/);
    assert.match(controlCenter, /OrganizationService\.deletePermissionProfile/);
});

test("organization tables keep the mobile layout to the essential columns", () => {
    const peopleSection = controlCenter.slice(
        controlCenter.indexOf("function CurrentMembersTable"),
        controlCenter.indexOf("function MemberHistoryTable"),
    );

    assert.match(peopleSection, /hidden text-\[var\(--btn-secondary-text\)\] xl:table-cell xl:w-\[23%\]/);
    assert.match(peopleSection, /xl:hidden/);
});

test("organization tables paginate with the shared shadcn controls and keep permission selection easy to scan", () => {
    const pagination = readFileSync(new URL("../components/ui/data-table-pagination.tsx", import.meta.url), "utf8");

    assert.match(controlCenter, /useDataTablePagination/);
    assert.match(controlCenter, /<OrganizationTablePagination/);
    assert.match(controlCenter, /toggleCategory/);
    assert.match(controlCenter, /selectedPermissionCodeSet.has\(definition\.code\)/);
    assert.match(pagination, /@\/components\/ui\/pagination/);
    assert.match(pagination, /@\/components\/ui\/select/);
    assert.match(pagination, /\[10, 25, 50, 100\]/);
});
