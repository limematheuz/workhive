"use client";

import { useMemo, useState } from "react";
import { Clock3, MailCheck, RefreshCw, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DeleteConfirmDialog } from "@/components/ui/delete-confirm-dialog";
import { useDictionary } from "@/lib/dictionary-context";
import { getErrorMessage } from "@/lib/errors";
import { toast } from "@/lib/toast";
import { UserService, type UserInvitation } from "@/services/user.service";

export function PendingInvitationsPanel({
    invitations,
    onChanged,
}: {
    invitations: UserInvitation[];
    onChanged: () => Promise<void>;
}) {
    const { dict, locale } = useDictionary();
    const copy = dict.organization.invitations;
    const [cancelTarget, setCancelTarget] = useState<UserInvitation | null>(null);
    const [resendTarget, setResendTarget] = useState<UserInvitation | null>(null);
    const [workingId, setWorkingId] = useState<number | null>(null);
    const dateFormatter = useMemo(
        () => new Intl.DateTimeFormat(locale, {
            day: "2-digit",
            month: "short",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
        }),
        [locale],
    );

    const cancelInvitation = async () => {
        if (!cancelTarget) return;
        try {
            setWorkingId(cancelTarget.id);
            await UserService.cancelInvitation(cancelTarget.id);
            await onChanged();
            setCancelTarget(null);
            toast.success(copy.cancel_success);
        } catch (error) {
            toast.error(getErrorMessage(error, copy.cancel_error));
        } finally {
            setWorkingId(null);
        }
    };

    const resendInvitation = async () => {
        if (!resendTarget) return;
        try {
            setWorkingId(resendTarget.id);
            await UserService.inviteUser({
                email: resendTarget.email,
                full_name: resendTarget.full_name || undefined,
                role_id: resendTarget.role_id,
            });
            await onChanged();
            setResendTarget(null);
            toast.success(copy.resend_success);
        } catch (error) {
            toast.error(getErrorMessage(error, copy.resend_error));
        } finally {
            setWorkingId(null);
        }
    };

    if (invitations.length === 0) return null;

    return (
        <section className="billing-surface overflow-hidden rounded-[26px]">
            <header className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-start gap-3">
                    <span className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-xl bg-accent/10 text-accent">
                        <MailCheck className="h-4 w-4" aria-hidden="true" />
                    </span>
                    <div>
                        <h2 className="text-sm font-semibold text-[var(--text-main)]">{copy.title}</h2>
                        <p className="mt-1 text-xs text-[var(--text-muted)]">{copy.description}</p>
                    </div>
                </div>
                <Badge variant="outline" className="w-fit border-accent/30 bg-accent/10 text-accent">
                    {invitations.length} {invitations.length === 1 ? copy.count_one : copy.count_many}
                </Badge>
            </header>
            <div className="divide-y divide-[var(--border-soft)] border-t border-[var(--border-soft)]">
                {invitations.map((invitation) => {
                    const isPending = invitation.status === "pending";
                    const accessKey = invitation.role_name === "admin"
                        ? "admin"
                        : invitation.role_name === "manager"
                            ? "responsible"
                            : "worker";
                    return (
                        <div key={invitation.id} className="flex flex-col gap-3 px-5 py-3.5 sm:flex-row sm:items-center sm:justify-between">
                            <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                    <p className="truncate text-sm font-semibold text-[var(--text-main)]">{invitation.full_name || invitation.email}</p>
                                    <Badge variant="outline" className={isPending ? "border-amber-500/35 bg-amber-500/10 text-amber-700 dark:text-amber-300" : "border-[var(--border-soft)] text-[var(--text-muted)]"}>{copy.statuses[invitation.status]}</Badge>
                                    {invitation.rejoin_existing_identity && <Badge variant="outline" className="border-accent/30 bg-accent/10 text-accent">{copy.existing_account}</Badge>}
                                </div>
                                <p className="mt-0.5 truncate text-xs text-[var(--text-muted)]">{invitation.email} · {copy.role_prefix} {dict.organization.access[accessKey]}</p>
                                <p className="mt-1 flex items-center gap-1.5 text-xs text-[var(--text-muted)]"><Clock3 className="h-3.5 w-3.5" aria-hidden="true" />{isPending ? copy.expires.replace("{date}", dateFormatter.format(new Date(invitation.expires_at))) : copy.created.replace("{date}", dateFormatter.format(new Date(invitation.created_at)))}</p>
                            </div>
                            <div className="flex shrink-0 gap-2">
                                <Button type="button" variant="outline" size="sm" disabled={workingId === invitation.id} onClick={() => setResendTarget(invitation)}>
                                    <RefreshCw className="h-3.5 w-3.5" />
                                    {copy.resend}
                                </Button>
                                {isPending && <Button type="button" variant="ghost" size="sm" disabled={workingId === invitation.id} onClick={() => setCancelTarget(invitation)}>
                                    <X className="h-3.5 w-3.5" />
                                    {copy.cancel}
                                </Button>}
                            </div>
                        </div>
                    );
                })}
            </div>
            <DeleteConfirmDialog
                open={cancelTarget !== null}
                onOpenChange={(open) => !open && setCancelTarget(null)}
                title={copy.cancel_title}
                description={copy.cancel_description.replace("{email}", cancelTarget?.email || "")}
                onConfirm={() => void cancelInvitation()}
                isDeleting={workingId === cancelTarget?.id}
                confirmText={copy.cancel_confirm}
                cancelText={dict.organization.actions.cancel}
                confirmIcon={X}
                confirmVariant="soft-danger"
            />
            <DeleteConfirmDialog
                open={resendTarget !== null}
                onOpenChange={(open) => !open && setResendTarget(null)}
                title={copy.resend_title}
                description={copy.resend_description.replace("{email}", resendTarget?.email || "")}
                onConfirm={() => void resendInvitation()}
                isDeleting={workingId === resendTarget?.id}
                confirmText={copy.resend_confirm}
                cancelText={dict.organization.actions.cancel}
                confirmIcon={RefreshCw}
                confirmVariant="primary"
            />
        </section>
    );
}
