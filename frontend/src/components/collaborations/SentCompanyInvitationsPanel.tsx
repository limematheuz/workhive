"use client";

import { MailCheck } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CompanyCollaborationInvitation } from "@/types/collaboration";
import { useDictionary } from "@/lib/dictionary-context";

export function SentCompanyInvitationsPanel({
    invitations,
    onRevoke,
}: {
    invitations: CompanyCollaborationInvitation[];
    onRevoke: (invitation: CompanyCollaborationInvitation) => void;
}) {
    const { dict } = useDictionary();
    const pending = invitations.filter((invitation) => invitation.status === "pending");
    if (pending.length === 0) return null;

    return (
        <section className="billing-surface billing-surface-accent-pad rounded-[24px]">
            <header className="mb-3 flex items-center gap-2.5">
                <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-accent/10 text-accent">
                    <MailCheck className="h-4 w-4" aria-hidden="true" />
                </span>
                <div>
                    <h2 className="text-base font-semibold text-[var(--text-main)]">{dict.collaborations.email_invitations}</h2>
                    <p className="mt-0.5 text-xs text-[var(--text-muted)]">{dict.collaborations.email_invitations_description}</p>
                </div>
            </header>
            <div className="space-y-2">
                {pending.map((invitation) => (
                    <div key={invitation.id} className="billing-block flex items-center justify-between gap-3 rounded-xl px-3.5 py-3">
                        <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-[var(--text-main)]">{invitation.email}</p>
                            <p className="text-xs text-[var(--text-muted)]">
                                {invitation.role_type === "service_provider" ? dict.collaborations.service_provider : dict.collaborations.property_manager}
                            </p>
                        </div>
                        <Badge variant="outline" className="shrink-0 border-accent/25 bg-accent/10 text-accent">{dict.collaborations.pending}</Badge>
                        <Button type="button" variant="dangerSoft" size="xs" onClick={() => onRevoke(invitation)}>{dict.collaborations.revoke}</Button>
                    </div>
                ))}
            </div>
        </section>
    );
}
