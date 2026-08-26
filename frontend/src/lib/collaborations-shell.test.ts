import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function source(path: string): string {
    return readFileSync(new URL(path, import.meta.url), "utf8");
}

test("partner companies are managed inside Team and preserve the legacy route", () => {
    const page = source("../app/dashboard/collaborations/page.tsx");
    const management = source("../components/collaborations/CollaborationManagementPanel.tsx");
    const emailInvitation = source("../components/collaborations/CompanyEmailInvitationForm.tsx");
    const invitationDialog = source("../components/collaborations/CompanyInvitationDialog.tsx");
    const active = source("../components/collaborations/ActiveCollaboratorsPanel.tsx");

    assert.match(page, /redirect\("\/dashboard\/users\?tab=companies"\)/);
    assert.match(management, /SentCompanyInvitationsPanel/);
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
