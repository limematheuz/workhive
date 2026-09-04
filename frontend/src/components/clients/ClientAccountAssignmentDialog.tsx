"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Loader2, UserRound } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldContent, FieldLabel } from "@/components/ui/field";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useDictionary } from "@/lib/dictionary-context";
import { getErrorMessage } from "@/lib/errors";
import { toast } from "@/lib/toast";
import { ClientAccountAssignmentService } from "@/services/client-account-assignment.service";
import type { Client, ClientAccountAssignmentCandidate } from "@/types/client";

type ClientAccountAssignmentDialogProps = {
    client: Client | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSaved: () => Promise<void>;
};

const UNASSIGNED_VALUE = "unassigned";

export function ClientAccountAssignmentDialog({
    client,
    open,
    onOpenChange,
    onSaved,
}: ClientAccountAssignmentDialogProps) {
    const { dict } = useDictionary();
    const copy = dict.clients.account_assignment;
    const [candidates, setCandidates] = useState<ClientAccountAssignmentCandidate[]>([]);
    const [membershipId, setMembershipId] = useState(UNASSIGNED_VALUE);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (!open || !client) return;

        let cancelled = false;
        const timeoutId = window.setTimeout(() => {
            setLoading(true);
            setMembershipId(client.account_assignment?.membership_id
                ? String(client.account_assignment.membership_id)
                : UNASSIGNED_VALUE);
            void ClientAccountAssignmentService.getCandidates(client.id)
                .then((items) => {
                    if (!cancelled) setCandidates(items);
                })
                .catch((error) => {
                    if (!cancelled) toast.error(getErrorMessage(error, copy.load_error));
                })
                .finally(() => {
                    if (!cancelled) setLoading(false);
                });
        }, 0);

        return () => {
            cancelled = true;
            window.clearTimeout(timeoutId);
        };
    }, [client, copy.load_error, open]);

    const submit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (!client) return;

        try {
            setSaving(true);
            await ClientAccountAssignmentService.replace(
                client.id,
                membershipId === UNASSIGNED_VALUE ? null : Number(membershipId),
            );
            await onSaved();
            toast.success(copy.save_success);
            onOpenChange(false);
        } catch (error) {
            toast.error(getErrorMessage(error, copy.save_error));
        } finally {
            setSaving(false);
        }
    };

    if (!client) return null;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent compact className="gap-0 p-0">
                <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col">
                    <DialogHeader className="border-b border-[var(--border-soft)] px-5 py-5 text-left sm:px-6">
                        <div className="flex items-start gap-3 pr-10">
                            <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-[var(--brand-blue-soft)] text-accent" aria-hidden="true">
                                <UserRound className="size-4" />
                            </span>
                            <div>
                                <DialogTitle>{copy.dialog_title}</DialogTitle>
                                <DialogDescription className="mt-1.5">{copy.dialog_description}</DialogDescription>
                            </div>
                        </div>
                    </DialogHeader>
                    <div className="px-5 py-5 sm:px-6">
                        {loading ? (
                            <div className="flex min-h-24 items-center justify-center text-sm text-[var(--text-muted)]">
                                <Loader2 className="mr-2 size-4 animate-spin" />
                                {copy.loading}
                            </div>
                        ) : (
                            <Field>
                                <FieldLabel htmlFor="client-account-owner">{copy.select_label}</FieldLabel>
                                <FieldContent>
                                    <Select value={membershipId} onValueChange={setMembershipId}>
                                        <SelectTrigger id="client-account-owner" className="h-11 bg-[var(--bg-primary)]/45">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value={UNASSIGNED_VALUE}>{copy.unassigned}</SelectItem>
                                            {candidates.map((candidate) => (
                                                <SelectItem key={candidate.membership_id} value={String(candidate.membership_id)}>
                                                    {candidate.full_name} · {candidate.email}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </FieldContent>
                            </Field>
                        )}
                    </div>
                    <DialogFooter className="border-t border-[var(--border-soft)] px-5 py-4 sm:px-6">
                        <Button type="button" variant="outline" className="btn-cancel-muted" onClick={() => onOpenChange(false)}>
                            {copy.cancel}
                        </Button>
                        <Button type="submit" disabled={loading || saving}>
                            {saving && <Loader2 className="size-4 animate-spin" />}
                            {saving ? copy.saving : copy.save}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
