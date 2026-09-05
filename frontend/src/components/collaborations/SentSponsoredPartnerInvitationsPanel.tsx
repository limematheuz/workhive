"use client";

import { Building2, MailCheck } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useDictionary } from "@/lib/dictionary-context";
import type { SponsoredPartnerInvitation } from "@/types/sponsored-partner-invitation";

export function SentSponsoredPartnerInvitationsPanel({
    invitations,
    onRevoke,
}: {
    invitations: SponsoredPartnerInvitation[];
    onRevoke: (invitation: SponsoredPartnerInvitation) => void;
}) {
    const { dict } = useDictionary();
    const pending = invitations.filter((invitation) => invitation.status === "pending");
    if (pending.length === 0) return null;

    return (
        <section className="billing-surface billing-surface-accent-pad rounded-[24px]">
            <header className="mb-3 flex items-center gap-2.5">
                <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-accent/10 text-accent">
                    <Building2 className="h-4 w-4" aria-hidden="true" />
                </span>
                <div>
                    <h2 className="text-base font-semibold text-[var(--text-main)]">{dict.collaborations.sponsored_invitations}</h2>
                    <p className="mt-0.5 text-xs leading-5 text-[var(--text-muted)]">{dict.collaborations.sponsored_invitations_description}</p>
                </div>
            </header>
            <div className="space-y-2">
                {pending.map((invitation) => (
                    <div key={invitation.id} className="billing-block flex items-center justify-between gap-3 rounded-xl px-3.5 py-3">
                        <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-[var(--text-main)]">{invitation.company_name}</p>
                            <p className="truncate text-xs text-[var(--text-muted)]">{invitation.email}</p>
                        </div>
                        <Badge variant="outline" className="shrink-0 border-accent/25 bg-accent/10 text-accent">{dict.collaborations.pending}</Badge>
                        <Button type="button" variant="dangerSoft" size="xs" onClick={() => onRevoke(invitation)}>
                            <MailCheck className="h-3.5 w-3.5" />
                            {dict.collaborations.revoke}
                        </Button>
                    </div>
                ))}
            </div>
        </section>
    );
}
