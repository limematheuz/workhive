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
const filters = readFileSync(
    new URL("../components/organization/OrganizationTableFilters.tsx", import.meta.url),
    "utf8",
);
const pendingInvitations = readFileSync(
    new URL("../components/organization/PendingInvitationsPanel.tsx", import.meta.url),
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
    assert.match(controlCenter, /OrganizationService\.removeMember/);
    assert.match(invitationDialog, /@\/components\/ui\/dialog/);
    assert.match(invitationDialog, /@\/components\/ui\/input/);
    assert.match(invitationDialog, /@\/components\/ui\/select/);
    assert.match(invitationDialog, /<DialogContent compact className="max-h-\[90dvh\] max-w-xl overflow-y-auto">/);
    assert.doesNotMatch(invitationDialog, /overflow-x-hidden/);
    assert.match(invitationDialog, /UserService\.inviteUser/);
    assert.match(invitationDialog, /await onSent\(\)/);
    assert.match(invitationDialog, /useDictionary/);
});

test("organization invitation status uses service calls and shadcn confirmation controls", () => {
    assert.match(controlCenter, /PendingInvitationsPanel/);
    assert.match(controlCenter, /UserService\.getInvitations/);
    assert.match(pendingInvitations, /@\/components\/ui\/button/);
    assert.match(pendingInvitations, /@\/components\/ui\/delete-confirm-dialog/);
    assert.match(pendingInvitations, /UserService\.cancelInvitation/);
    assert.match(pendingInvitations, /UserService\.inviteUser/);
    assert.doesNotMatch(pendingInvitations, /<button/);
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
    assert.match(controlCenter, /<DialogContent className="permission-profile-dialog[^\"]*overflow-hidden p-0">/);
    assert.match(controlCenter, /max-h-\[min\(42dvh,23rem\)\] space-y-2 overflow-y-auto/);
    assert.match(controlCenter, /@\/components\/ui\/collapsible/);
    assert.match(controlCenter, /<CollapsibleContent className="border-t border-\[var\(--border-soft\)\] px-3 py-2 pl-12">/);
    assert.match(controlCenter, /permission_details/);
    assert.match(controlCenter, /flex min-w-0 items-center gap-3 px-3 py-2/);
    assert.match(controlCenter, /disabled=\{definition\.is_system_only && !canRemoveLegacySelection\}/);
    assert.doesNotMatch(controlCenter, /definition\.recommended_for\.map/);
    assert.doesNotMatch(controlCenter, /profileCopy\.company_scope_note/);
    assert.match(controlCenter, /profileCopy\.reserved_for_administrators/);
    assert.match(controlCenter, /function ProfilesTable/);
    assert.match(controlCenter, /copy\.profiles\.actions/);
    assert.match(controlCenter, /permissionLabel\(/);
    assert.doesNotMatch(controlCenter, /profile\.permission_codes\.join/);
    assert.match(controlCenter, /ActionPopover/);
    assert.match(controlCenter, /OrganizationService\.updatePermissionProfile/);
    assert.match(controlCenter, /OrganizationService\.deletePermissionProfile/);
    assert.match(controlCenter, /const canManage = canManageProfiles && profile\.is_editable/);
    assert.match(controlCenter, /useOrganizationPermission\("access\.profiles\.manage"\)/);
    assert.match(controlCenter, /profileCopy\.default_edit_description/);
    assert.match(controlCenter, /profileCopy\.default_name_locked/);
    assert.match(controlCenter, /disabled=\{Boolean\(profile\?\.is_system\)\}/);
    const memberAccessDialog = readFileSync(
        new URL("../components/organization/MemberAccessDialog.tsx", import.meta.url),
        "utf8",
    );
    assert.match(memberAccessDialog, /profile\.is_editable && \(profile\.is_active \|\| assignments\.some/);
    assert.match(memberAccessDialog, /profile_assignments: \{ assignments: assignmentPayload\(assignments\) \}/);
    assert.doesNotMatch(memberAccessDialog, /await OrganizationService\.replaceMemberProfileAssignments/);
});

test("organization tables keep the mobile layout to the essential columns", () => {
    const peopleSection = controlCenter.slice(
        controlCenter.indexOf("function CurrentMembersTable"),
        controlCenter.indexOf("function MemberHistoryTable"),
    );

    assert.match(peopleSection, /hidden text-\[var\(--btn-secondary-text\)\] xl:table-cell xl:w-\[23%\]/);
    assert.match(peopleSection, /xl:hidden/);
    assert.match(peopleSection, /CurrentMemberCard/);
    assert.match(peopleSection, /hidden lg:block/);
    assert.match(peopleSection, /grid gap-2\.5 p-3 lg:hidden/);
});

test("organization tables paginate with the shared shadcn controls and keep permission selection easy to scan", () => {
    const pagination = readFileSync(new URL("../components/ui/data-table-pagination.tsx", import.meta.url), "utf8");

    assert.match(controlCenter, /useDataTablePagination/);
    assert.match(controlCenter, /<OrganizationTablePagination/);
    assert.match(controlCenter, /toggleCategory/);
    assert.match(controlCenter, /selectedPermissionCodeSet.has\(definition\.code\)/);
    assert.match(pagination, /@\/components\/ui\/pagination/);
    assert.match(pagination, /@\/components\/ui\/select/);
    assert.match(pagination, /new Set\(\[10, 25, 50, 100, pageSize\]\)/);
    assert.match(pagination, /useId/);
    assert.doesNotMatch(pagination, /if \(totalItems <= 20\) return null/);
});

test("organization tabs use shared shadcn text and select filters instead of custom controls", () => {
    const departmentsPanel = readFileSync(
        new URL("../components/organization/OrganizationDepartmentsPanel.tsx", import.meta.url),
        "utf8",
    );

    assert.match(filters, /@\/components\/ui\/input/);
    assert.match(filters, /@\/components\/ui\/button/);
    assert.match(filters, /type="search"/);
    assert.match(filters, /aria-live="polite"/);
    assert.match(controlCenter, /filterOrganizationMembers/);
    assert.match(controlCenter, /filterPermissionProfiles/);
    assert.match(teamsPanel, /filterOrganizationTeams/);
    assert.match(departmentsPanel, /filterOrganizationDepartments/);
    assert.match(controlCenter, /@\/components\/ui\/select/);
    assert.match(teamsPanel, /@\/components\/ui\/select/);
    assert.match(departmentsPanel, /@\/components\/ui\/select/);
    assert.match(controlCenter, /PermissionProfileCard/);
    assert.match(controlCenter, /from "@\/components\/ui\/card"/);
    assert.match(controlCenter, /function PermissionProfileCard/);
    assert.match(teamsPanel, /function TeamCard/);
    assert.match(departmentsPanel, /function DepartmentCard/);
});
