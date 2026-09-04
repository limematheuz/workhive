"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Check, Loader2, Search, UserRound } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldContent, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
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
    const [query, setQuery] = useState("");
    const [profileFilter, setProfileFilter] = useState("all");
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
            setQuery("");
            setProfileFilter("all");
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

    const profileOptions = [...new Set(candidates.flatMap((candidate) => candidate.profile_names))]
        .sort((left, right) => left.localeCompare(right));
    const normalizedQuery = query.trim().toLocaleLowerCase();
    const filteredCandidates = candidates.filter((candidate) => (
        (profileFilter === "all" || candidate.profile_names.includes(profileFilter))
        && (!normalizedQuery
            || `${candidate.full_name} ${candidate.email} ${candidate.profile_names.join(" ")}`
                .toLocaleLowerCase()
                .includes(normalizedQuery))
    ));

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
                            <div className="space-y-4">
                                <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_11rem]">
                                    <Field>
                                        <FieldLabel htmlFor="client-account-owner-search">{copy.search_label}</FieldLabel>
                                        <FieldContent>
                                            <div className="relative">
                                                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--text-muted)]" aria-hidden="true" />
                                                <Input
                                                    id="client-account-owner-search"
                                                    type="search"
                                                    value={query}
                                                    onChange={(event) => setQuery(event.target.value)}
                                                    placeholder={copy.search_placeholder}
                                                    className="h-11 rounded-xl bg-[var(--bg-primary)]/45 pl-9"
                                                />
                                            </div>
                                        </FieldContent>
                                    </Field>
                                    <Field>
                                        <FieldLabel htmlFor="client-account-owner-profile">{copy.profile_label}</FieldLabel>
                                        <FieldContent>
                                            <Select value={profileFilter} onValueChange={setProfileFilter}>
                                                <SelectTrigger id="client-account-owner-profile" className="h-11 bg-[var(--bg-primary)]/45">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="all">{copy.all_profiles}</SelectItem>
                                                    {profileOptions.map((profileName) => (
                                                        <SelectItem key={profileName} value={profileName}>{profileName}</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </FieldContent>
                                    </Field>
                                </div>
                                <div>
                                    <FieldLabel>{copy.select_label}</FieldLabel>
                                    <p className="mt-1 text-xs leading-5 text-[var(--text-muted)]">{copy.eligible_hint}</p>
                                    <div className="mt-2 overflow-hidden rounded-xl border border-[var(--border-soft)] bg-[var(--bg-primary)]/25">
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            onClick={() => setMembershipId(UNASSIGNED_VALUE)}
                                            className="h-auto w-full justify-start rounded-none px-3 py-3 text-left hover:bg-[var(--bg-secondary)]/60"
                                        >
                                            <span className="flex size-5 shrink-0 items-center justify-center rounded-full border border-[var(--border-soft)]">
                                                {membershipId === UNASSIGNED_VALUE && <Check className="size-3.5 text-accent" aria-hidden="true" />}
                                            </span>
                                            <span className="ml-3 text-sm font-medium">{copy.unassigned}</span>
                                        </Button>
                                        <div className="max-h-56 overflow-y-auto border-t border-[var(--border-soft)]">
                                            {filteredCandidates.length === 0 ? (
                                                <p className="px-3 py-5 text-center text-sm text-[var(--text-muted)]">{copy.no_results}</p>
                                            ) : filteredCandidates.map((candidate) => {
                                                const selected = membershipId === String(candidate.membership_id);
                                                return (
                                                    <Button
                                                        key={candidate.membership_id}
                                                        type="button"
                                                        variant="ghost"
                                                        onClick={() => setMembershipId(String(candidate.membership_id))}
                                                        className="h-auto w-full justify-start rounded-none px-3 py-3 text-left hover:bg-[var(--bg-secondary)]/60"
                                                    >
                                                        <span className="flex size-5 shrink-0 items-center justify-center rounded-full border border-[var(--border-soft)]">
                                                            {selected && <Check className="size-3.5 text-accent" aria-hidden="true" />}
                                                        </span>
                                                        <span className="ml-3 min-w-0 flex-1">
                                                            <span className="block truncate text-sm font-medium text-[var(--text-main)]">{candidate.full_name}</span>
                                                            <span className="mt-0.5 block truncate text-xs text-[var(--text-muted)]">{candidate.email}</span>
                                                        </span>
                                                        <span className="ml-3 flex max-w-32 flex-wrap justify-end gap-1">
                                                            {candidate.profile_names.map((profileName) => (
                                                                <Badge key={profileName} variant="secondary" className="max-w-full truncate text-[10px] font-medium">{profileName}</Badge>
                                                            ))}
                                                        </span>
                                                    </Button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                </div>
                            </div>
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
