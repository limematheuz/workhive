"use client";

import { useCallback, useEffect, useEffectEvent, useRef, useState } from "react";
import { toast } from "sonner";

import { ActiveCollaboratorsPanel } from "@/components/collaborations/ActiveCollaboratorsPanel";
import { SentCompanyInvitationsPanel } from "@/components/collaborations/SentCompanyInvitationsPanel";
import { SentSponsoredPartnerInvitationsPanel } from "@/components/collaborations/SentSponsoredPartnerInvitationsPanel";
import { DeleteConfirmDialog } from "@/components/ui/delete-confirm-dialog";
import { ReadRecoveryBanner } from "@/components/ui/read-recovery-banner";
import { useBackgroundPolling } from "@/hooks/useBackgroundPolling";
import { useRealtimeInvalidation } from "@/hooks/useRealtimeEvents";
import { useDictionary } from "@/lib/dictionary-context";
import { POLL_INTERVALS } from "@/lib/polling";
import {
    classifyReadError,
    getReadRecoveryMessage,
    getReadWorkspaceKey,
    shouldShowReadRetry,
    type ReadErrorKind,
} from "@/lib/read-recovery";
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
    const [loading, setLoading] = useState(true);
    const [retrying, setRetrying] = useState(false);
    const [mainErrorKind, setMainErrorKind] = useState<ReadErrorKind | null>(null);
    const [sponsoredErrorKind, setSponsoredErrorKind] = useState<ReadErrorKind | null>(null);
    const [hasMainSnapshot, setHasMainSnapshot] = useState(false);
    const [hasSponsoredSnapshot, setHasSponsoredSnapshot] = useState(false);
    const [unlinkTarget, setUnlinkTarget] = useState<CompanyCollaboration | null>(null);
    const [unlinking, setUnlinking] = useState(false);
    const lastLoadError = useRef<string | null>(null);
    const requestIdRef = useRef(0);
    const loadedWorkspaceRef = useRef<string | null>(null);

    const workspaceKey = getReadWorkspaceKey(user);
    const canManage = ["admin", "manager"].includes(user?.role?.name || "") && Boolean(user?.company_id);
    const canInviteByEmail = user?.role?.name === "admin" && Boolean(user?.company_id);

    const loadData = useCallback(async (isRetry = false) => {
        const requestId = ++requestIdRef.current;
        if (!canManage) {
            setCollaborations([]);
            setSentInvitations([]);
            setSponsoredInvitations([]);
            setMainErrorKind(null);
            setSponsoredErrorKind(null);
            setHasMainSnapshot(false);
            setHasSponsoredSnapshot(false);
            setLoading(false);
            setRetrying(false);
            return;
        }
        const workspaceChanged = loadedWorkspaceRef.current !== workspaceKey;
        loadedWorkspaceRef.current = workspaceKey;
        if (workspaceChanged) {
            setCollaborations([]);
            setSentInvitations([]);
            setSponsoredInvitations([]);
            setMainErrorKind(null);
            setSponsoredErrorKind(null);
            setHasMainSnapshot(false);
            setHasSponsoredSnapshot(false);
            setLoading(true);
        } else if (isRetry) {
            setRetrying(true);
        }

        let nextMainError: ReadErrorKind | null = null;
        let nextSponsoredError: ReadErrorKind | null = null;

        try {
            const [active, invitations] = await Promise.all([
                CollaborationService.getCollaborations(),
                canInviteByEmail ? CollaborationService.getSentCompanyInvitations() : Promise.resolve([]),
            ]);
            if (requestId !== requestIdRef.current) return;
            setCollaborations(active);
            setSentInvitations(invitations);
            setHasMainSnapshot(true);
            setMainErrorKind(null);
        } catch (error) {
            if (requestId !== requestIdRef.current) return;
            nextMainError = classifyReadError(error);
            setMainErrorKind(nextMainError);
            if (nextMainError === "denied") {
                setCollaborations([]);
                setSentInvitations([]);
                setHasMainSnapshot(false);
            }
        }

        if (canInviteByEmail) {
            try {
                const sponsored = await sponsoredPartnerInvitationService.getSent();
                if (requestId !== requestIdRef.current) return;
                setSponsoredInvitations(sponsored);
                setHasSponsoredSnapshot(true);
                setSponsoredErrorKind(null);
            } catch (error) {
                if (requestId !== requestIdRef.current) return;
                nextSponsoredError = classifyReadError(error);
                setSponsoredErrorKind(nextSponsoredError);
                if (nextSponsoredError === "denied") {
                    setSponsoredInvitations([]);
                    setHasSponsoredSnapshot(false);
                }
            }
        } else {
            if (requestId !== requestIdRef.current) return;
            setSponsoredInvitations([]);
            setSponsoredErrorKind(null);
            setHasSponsoredSnapshot(true);
        }

        const errorSignature = nextMainError || nextSponsoredError
            ? `${nextMainError ?? "ok"}:${nextSponsoredError ?? "ok"}`
            : null;
        lastLoadError.current = errorSignature;
        setLoading((current) => requestId === requestIdRef.current ? false : current);
        setRetrying((current) => requestId === requestIdRef.current ? false : current);
    }, [canInviteByEmail, canManage, workspaceKey]);

    const syncLoad = useEffectEvent(() => {
        void loadData();
    });

    useEffect(() => {
        const timeoutId = window.setTimeout(() => syncLoad(), 0);
        return () => window.clearTimeout(timeoutId);
    }, [refreshKey, workspaceKey, canManage, canInviteByEmail]);
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

    const mainErrorMessage = getReadRecoveryMessage(mainErrorKind, {
        unavailable: dict.collaborations.load_error,
        denied: dict.collaborations.load_denied,
    });
    const sponsoredErrorMessage = getReadRecoveryMessage(sponsoredErrorKind, {
        unavailable: dict.collaborations.sponsored_invitations_load_error,
        denied: dict.collaborations.sponsored_invitations_load_denied,
    });
    const showMainPanels = !mainErrorKind || hasMainSnapshot;
    const showSponsoredPanel = canInviteByEmail && hasSponsoredSnapshot;

    return (
        <div className="space-y-5">
            {mainErrorKind && mainErrorMessage && (
                <ReadRecoveryBanner
                    kind={mainErrorKind}
                    message={mainErrorMessage}
                    retryLabel={dict.collaborations.retry}
                    onRetry={shouldShowReadRetry(mainErrorKind) ? () => void loadData(true) : undefined}
                    retrying={retrying}
                />
            )}
            {sponsoredErrorKind && sponsoredErrorMessage && !mainErrorKind && (
                <ReadRecoveryBanner
                    kind={sponsoredErrorKind}
                    message={sponsoredErrorMessage}
                    retryLabel={dict.collaborations.retry}
                    onRetry={shouldShowReadRetry(sponsoredErrorKind) ? () => void loadData(true) : undefined}
                    retrying={retrying}
                />
            )}
            {showMainPanels && <SentCompanyInvitationsPanel invitations={sentInvitations} onRevoke={handleRevokeInvitation} />}
            {showSponsoredPanel && <SentSponsoredPartnerInvitationsPanel invitations={sponsoredInvitations} onRevoke={handleRevokeSponsoredInvitation} />}
            {!canInviteByEmail && <p className="text-sm text-[var(--text-muted)]">{dict.collaborations.invite_admin_only}</p>}
            {showMainPanels && <ActiveCollaboratorsPanel collaborations={collaborations} loading={loading} companyId={user?.company_id} canManagePartnerPortal={canInviteByEmail} onUnlink={setUnlinkTarget} />}
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
