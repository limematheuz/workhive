"use client";

import { useState } from "react";
import { Building2, Plus } from "lucide-react";

import { CollaborationManagementPanel } from "@/components/collaborations/CollaborationManagementPanel";
import { CompanyInvitationDialog } from "@/components/collaborations/CompanyInvitationDialog";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { useDictionary } from "@/lib/dictionary-context";
import { useUser } from "@/lib/user-context";

export function CollaborationControlCenter() {
    const { dict } = useDictionary();
    const { user } = useUser();
    const [inviteOpen, setInviteOpen] = useState(false);
    const [refreshKey, setRefreshKey] = useState(0);
    const canInvite = user?.role?.name === "admin" && Boolean(user.company_id);

    return (
        <div className="dashboard-page-content px-[3%] py-6 md:p-8">
            <PageHeader
                icon={Building2}
                title={dict.collaborations.title}
                subtitle={dict.collaborations.subtitle}
                className="mb-7"
                actions={canInvite ? <Button type="button" onClick={() => setInviteOpen(true)}><Plus className="mr-2 size-4" />{dict.collaborations.invite_company_action}</Button> : undefined}
            />
            <CollaborationManagementPanel refreshKey={refreshKey} />
            <CompanyInvitationDialog open={inviteOpen} onOpenChange={setInviteOpen} onSent={() => setRefreshKey((current) => current + 1)} />
        </div>
    );
}
