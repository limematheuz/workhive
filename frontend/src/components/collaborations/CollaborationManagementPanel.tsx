"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {Button} from "@/components/ui/button";
import { toast } from "sonner";

import { ActiveCollaboratorsPanel } from "@/components/collaborations/ActiveCollaboratorsPanel";
import { SentCompanyInvitationsPanel } from "@/components/collaborations/SentCompanyInvitationsPanel";
import { SentSponsoredPartnerInvitationsPanel } from "@/components/collaborations/SentSponsoredPartnerInvitationsPanel";
import { DeleteConfirmDialog } from "@/components/ui/delete-confirm-dialog";
import { useBackgroundPolling } from "@/hooks/useBackgroundPolling";
import { useRealtimeInvalidation } from "@/hooks/useRealtimeEvents";
import { useDictionary } from "@/lib/dictionary-context";
import { POLL_INTERVALS } from "@/lib/polling";
import { useUser } from "@/lib/user-context";
import { CollaborationService } from "@/services/collaboration.service";
import { sponsoredPartnerInvitationService } from "@/services/sponsored-partner-invitation.service";
import { CompanyCollaboration, CompanyCollaborationInvitation } from "@/types/collaboration";
import type { SponsoredPartnerInvitation } from "@/types/sponsored-partner-invitation";

type CollaborationManagementPanelProps = {
    refreshKey: number;
};

export function CollaborationManagementPanel({
    refreshKey,
}: CollaborationManagementPanelProps) {
    const { user } = useUser();
    const { dict } = useDictionary();
    const [collaborations, setCollaborations] = useState<CompanyCollaboration[]>([]);
    const [sentInvitations, setSentInvitations] = useState<CompanyCollaborationInvitation[]>([]);
    const [sponsoredInvitations, setSponsoredInvitations] = useState<SponsoredPartnerInvitation[]>([]);
    const [loadError,setLoadError]=useState(false);
    const [loading, setLoading] = useState(true);
    const [unlinkTarget, setUnlinkTarget] = useState<CompanyCollaboration | null>(null);
    const [unlinking, setUnlinking] = useState(false);
    const lastLoadError = useRef<string | null>(null);

    const canManage = ["admin", "manager"].includes(user?.role?.name || "") && Boolean(user?.company_id);
    const canInviteByEmail = user?.role?.name === "admin" && Boolean(user?.company_id);

    const loadData = useCallback(async () => {
        if (!canManage) {
            setLoading(false);
            return;
        }
        let hasLoadError = false;
        try {
            const [active, invitations] = await Promise.all([
                CollaborationService.getCollaborations(),
                canInviteByEmail ? CollaborationService.getSentCompanyInvitations() : Promise.resolve([]),
            ]);
            setCollaborations(active);
            setSentInvitations(invitations);
        } catch (error) {
            hasLoadError = true;
            const message = error instanceof Error ? error.message : dict.collaborations.load_error;
            if (lastLoadError.current !== message) {
                toast.error(message);
                lastLoadError.current = message;
            }
        }

        if (canInviteByEmail) {
            try {
                setSponsoredInvitations(await sponsoredPartnerInvitationService.getSent());
            } catch {
                hasLoadError = true;
                const message = dict.collaborations.sponsored_invitations_load_error;
                setSponsoredInvitations([]);
                if (lastLoadError.current !== message) {
                    toast.error(message);
                    lastLoadError.current = message;
                }
            }
        } else {
            setSponsoredInvitations([]);
        }

        setLoading(false);
        setLoadError(hasLoadError);
        if (!hasLoadError) lastLoadError.current = null;
    }, [canInviteByEmail, canManage, dict.collaborations.load_error, dict.collaborations.sponsored_invitations_load_error]);

    useEffect(() => {
        const timeoutId = window.setTimeout(() => void loadData(), 0);
        return () => window.clearTimeout(timeoutId);
    }, [loadData, refreshKey]);
    useBackgroundPolling(
        loadData,
        POLL_INTERVALS.collaborations,
        POLL_INTERVALS.realtimeSafety,
    );
    useRealtimeInvalidation(["collaborations"], () => {
        void loadData();
    });

    const handleUnlink = async () => {
        if (!unlinkTarget) return;
        try {
            setUnlinking(true);
            await CollaborationService.deleteCollaboration(unlinkTarget.id);
            toast.success(dict.collaborations.company_unlinked);
            setUnlinkTarget(null);
            await loadData();
        } catch (error) {
            toast.error(error instanceof Error ? error.message : dict.collaborations.unlink_error);
        } finally {
            setUnlinking(false);
        }
    };

    const handleRevokeInvitation = async (invitation: CompanyCollaborationInvitation) => {
        try {
            await CollaborationService.revokeCompanyInvitation(invitation.id);
            toast.success(dict.collaborations.invite_revoked);
            await loadData();
        } catch (error) {
            toast.error(error instanceof Error ? error.message : dict.collaborations.revoke_error);
        }
    };

    const handleRevokeSponsoredInvitation = async (invitation: SponsoredPartnerInvitation) => {
        try {
            await sponsoredPartnerInvitationService.revoke(invitation.id);
            toast.success(dict.collaborations.sponsored_invite_revoked);
            await loadData();
        } catch (error) {
            toast.error(error instanceof Error ? error.message : dict.collaborations.sponsored_invite_revoke_error);
        }
    };

    if (!canManage) {
        return <p className="py-10 text-center text-sm text-[var(--text-muted)]">{dict.collaborations.no_permission}</p>;
    }

    return (
        <div className="space-y-5">
            {loadError&&<div role="alert" className="flex flex-wrap items-center gap-3 rounded-xl border border-orange-400/40 p-3"><p className="text-sm">No se pudo actualizar toda la red. Los datos visibles pueden estar incompletos.</p><Button variant="outline" size="sm" onClick={()=>void loadData()}>Reintentar</Button></div>}
            {!loading&&!loadError&&<div className="grid grid-cols-2 gap-2 sm:grid-cols-3">{[{label:"Colaboradores activos",count:collaborations.filter(row=>row.status==="accepted").length,target:"network-active"},{label:"Colaboraciones pendientes",count:collaborations.filter(row=>row.status==="pending").length,target:"network-active"},{label:"Invitaciones pendientes",count:[...sentInvitations,...sponsoredInvitations].filter(row=>row.status==="pending").length,target:"network-invites"}].map(metric=><a key={metric.label} href={"#"+metric.target} className="rounded-xl border bg-card p-3 focus-visible:outline-2 focus-visible:outline-accent"><span className="text-xs text-muted-foreground">{metric.label}</span><strong className="mt-1 block text-2xl font-semibold">{metric.count}</strong></a>)}</div>}
            <div id="network-invites"><SentCompanyInvitationsPanel invitations={sentInvitations} onRevoke={handleRevokeInvitation} />
            <SentSponsoredPartnerInvitationsPanel invitations={sponsoredInvitations} onRevoke={handleRevokeSponsoredInvitation} /></div>
            {!canInviteByEmail && <p className="text-sm text-[var(--text-muted)]">{dict.collaborations.invite_admin_only}</p>}
            <div id="network-active"><ActiveCollaboratorsPanel collaborations={collaborations} loading={loading} companyId={user?.company_id} canManagePartnerPortal={canInviteByEmail} onUnlink={setUnlinkTarget} /></div>
            <DeleteConfirmDialog
                open={unlinkTarget !== null}
                onOpenChange={(open) => !open && setUnlinkTarget(null)}
                title={dict.collaborations.unlink_title}
                description={dict.collaborations.unlink_description}
                onConfirm={handleUnlink}
                isDeleting={unlinking}
                confirmText={dict.collaborations.unlink_confirm}
                cancelText={dict.collaborations.cancel}
            />
        </div>
    );
}
