import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function source(path: string): string {
    return readFileSync(new URL(path, import.meta.url), "utf8");
}

test("partner companies have their own operational workspace", () => {
    const page = source("../app/dashboard/collaborations/page.tsx");
    const controlCenter = source("../components/collaborations/CollaborationControlCenter.tsx");
    const externalNetwork = source("../components/external-network/ExternalNetworkControlCenter.tsx");
    const addCollaborator = source("../components/collaborations/CollaboratorAddDialog.tsx");
    const management = source("../components/collaborations/CollaborationManagementPanel.tsx");
    const emailInvitation = source("../components/collaborations/CompanyEmailInvitationForm.tsx");
    const invitationDialog = source("../components/collaborations/CompanyInvitationDialog.tsx");
    const sponsoredInvitationDialog = source("../components/collaborations/SponsoredPropertyManagerInvitationDialog.tsx");
    const sponsoredInvitations = source("../components/collaborations/SentSponsoredPartnerInvitationsPanel.tsx");
    const active = source("../components/collaborations/ActiveCollaboratorsPanel.tsx");

    assert.match(page, /redirect\("\/dashboard\/external-network"\)/);
    assert.match(controlCenter, /PageHeader/);
    assert.match(controlCenter, /CollaborationManagementPanel/);
    assert.match(controlCenter, /CompanyInvitationDialog/);
    assert.match(controlCenter, /SponsoredPropertyManagerInvitationDialog/);
    assert.match(controlCenter, /CollaboratorAddDialog/);
    assert.match(controlCenter, /dict\.collaborations\.add_collaborator_action/);
    assert.match(externalNetwork, /PremiumTabs/);
    assert.match(externalNetwork, /CollaborationControlCenter embedded/);
    assert.match(externalNetwork, /ExternalAccessControlCenter embedded/);
    assert.match(externalNetwork, /router\.replace\(tab === "operations"/);
    assert.doesNotMatch(externalNetwork, /window\.history\.replaceState/);
    assert.match(addCollaborator, /connect_existing_company/);
    assert.match(addCollaborator, /invite_property_manager_portal/);
    assert.match(management, /SentCompanyInvitationsPanel/);
    assert.match(management, /SentSponsoredPartnerInvitationsPanel/);
    assert.doesNotMatch(management, /PremiumTabs/);
    assert.doesNotMatch(management, /PartnerCode|CollaborationConnectForm|CollaborationRequestsPanel/);
    assert.doesNotMatch(management, /onInviteCompany/);
    assert.doesNotMatch(management, /partner-company-invitations/);
    assert.match(management, /DeleteConfirmDialog/);
    assert.match(management, /cancelText=\{dict\.collaborations\.cancel\}/);
    assert.match(emailInvitation, /from "@\/components\/ui\/input"/);
    assert.match(emailInvitation, /from "@\/components\/ui\/label"/);
    assert.match(emailInvitation, /dict\.collaborations\.email_invite_title/);
    assert.match(invitationDialog, /CompanyEmailInvitationForm/);
    assert.match(invitationDialog, /CollaborationService\.inviteCompanyByEmail/);
    assert.match(sponsoredInvitationDialog, /sponsoredPartnerInvitationService\.invite/);
    assert.match(sponsoredInvitationDialog, /from "@\/components\/ui\/input"/);
    assert.match(sponsoredInvitations, /sponsored_invitations/);
    assert.match(management, /lastLoadError/);
    assert.match(management, /sponsored_invitations_load_error/);
    assert.doesNotMatch(page, /btn-cancel-muted/);
    assert.doesNotMatch(page, /surface-glass-card/);

    assert.match(active, /billing-surface/);
    assert.match(active, /billing-block/);
    assert.match(active, /from "@\/components\/ui\/badge"/);
    assert.match(active, /variant="dangerSoft"/);
    assert.match(active, /DocumentFormSelect/);
    assert.doesNotMatch(active, /PremiumTabs/);
    assert.doesNotMatch(active, /min-h-\[170px\]/);
    assert.doesNotMatch(active, /btn-cancel-muted/);
});
