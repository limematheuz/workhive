"use client";

import { useState } from "react";
import { Building2, Plus } from "lucide-react";

import { CollaborationManagementPanel } from "@/components/collaborations/CollaborationManagementPanel";
import { CollaboratorAddDialog } from "@/components/collaborations/CollaboratorAddDialog";
import { CompanyInvitationDialog } from "@/components/collaborations/CompanyInvitationDialog";
import { SponsoredPropertyManagerInvitationDialog } from "@/components/collaborations/SponsoredPropertyManagerInvitationDialog";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { useDictionary } from "@/lib/dictionary-context";
import { useUser } from "@/lib/user-context";

type CollaborationControlCenterProps = {
    embedded?: boolean;
};

export function CollaborationControlCenter({ embedded = false }: CollaborationControlCenterProps) {
    const { dict } = useDictionary();
    const { user } = useUser();
    const [addCollaboratorOpen, setAddCollaboratorOpen] = useState(false);
    const [inviteOpen, setInviteOpen] = useState(false);
    const [sponsoredInviteOpen, setSponsoredInviteOpen] = useState(false);
    const [refreshKey, setRefreshKey] = useState(0);
    const canInvite = user?.role?.name === "admin" && Boolean(user.company_id);
    const returnToCollaboratorChoice = (closeChild: (open: boolean) => void) => {
        closeChild(false);
        window.setTimeout(() => setAddCollaboratorOpen(true), 0);
    };

    const actions = canInvite ? (
        <Button type="button" onClick={() => setAddCollaboratorOpen(true)}>
            <Plus className="mr-2 size-4" />
            {dict.collaborations.add_collaborator_action}
        </Button>
    ) : undefined;

    const content = (
        <>
            {embedded ? (
                <PageHeader
                    icon={Building2}
                    title={dict.collaborations.title}
                    subtitle={dict.collaborations.subtitle}
                    titleAs="h2"
                    className="mb-6"
                    actions={actions}
                />
            ) : null}
            <CollaborationManagementPanel refreshKey={refreshKey} />
            <CollaboratorAddDialog
                open={addCollaboratorOpen}
                onOpenChange={setAddCollaboratorOpen}
                onChooseExistingCompany={() => setInviteOpen(true)}
                onChooseSponsoredPropertyManager={() => setSponsoredInviteOpen(true)}
            />
            <CompanyInvitationDialog open={inviteOpen} onOpenChange={setInviteOpen} onBack={() => returnToCollaboratorChoice(setInviteOpen)} onSent={() => setRefreshKey((current) => current + 1)} />
            <SponsoredPropertyManagerInvitationDialog open={sponsoredInviteOpen} onOpenChange={setSponsoredInviteOpen} onBack={() => returnToCollaboratorChoice(setSponsoredInviteOpen)} onSent={() => setRefreshKey((current) => current + 1)} />
        </>
    );

    if (embedded) return content;

    return (
        <div className="dashboard-page-content px-[3%] py-6 md:p-8">
            <PageHeader
                icon={Building2}
                title={dict.collaborations.title}
                subtitle={dict.collaborations.subtitle}
                className="mb-7"
                actions={actions}
            />
            {content}
        </div>
    );
}
