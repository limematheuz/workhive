"use client";

import { useCallback, useEffect, useState } from "react";
import { CalendarClock, ClipboardList, Loader2, Pencil, Plus, UserRound } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DateTimePicker } from "@/components/ui/date-time-picker";
import { Field, FieldContent, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useDictionary } from "@/lib/dictionary-context";
import { getErrorMessage } from "@/lib/errors";
import { toast } from "@/lib/toast";
import {
    ClientService,
    type Client,
    type ClientContact,
    type ClientOpportunity,
    type ClientOpportunityOwner,
    type ClientOpportunityPayload,
    type ClientOpportunityStage,
} from "@/services/client.service";

import { ClientOpportunityTimelineDialog } from "./ClientOpportunityTimelineDialog";

type ClientOpportunitiesTabProps = {
    client: Client;
    canManage: boolean;
};

const stages: ClientOpportunityStage[] = ["new", "qualified", "proposal", "negotiation", "won", "lost"];
const stageBadgeClassNames: Record<ClientOpportunityStage, string> = {
    new: "border border-sky-500/20 bg-sky-500/10 text-sky-700",
    qualified: "border border-violet-500/20 bg-violet-500/10 text-violet-700",
    proposal: "border border-amber-500/25 bg-amber-500/10 text-amber-800",
    negotiation: "border border-orange-500/25 bg-orange-500/10 text-orange-800",
    won: "border border-emerald-500/20 bg-emerald-500/10 text-emerald-700",
    lost: "border border-rose-500/20 bg-rose-500/10 text-rose-700",
};

function draftFromOpportunity(opportunity?: ClientOpportunity): ClientOpportunityPayload {
    return {
        title: opportunity?.title ?? "",
        contact_id: opportunity?.contact_id ?? null,
        owner_membership_id: opportunity?.owner_membership_id ?? null,
        stage: opportunity?.stage ?? "new",
        next_follow_up_at: opportunity?.next_follow_up_at ?? null,
        loss_reason: opportunity?.loss_reason ?? null,
    };
}

function formatDate(value: string | null, locale: string): string | null {
    if (!value) return null;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    return new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(date);
}

export function ClientOpportunitiesTab({ client, canManage }: ClientOpportunitiesTabProps) {
    const { dict, locale } = useDictionary();
    const copy = dict.clients.opportunities;
    const [opportunities, setOpportunities] = useState<ClientOpportunity[]>([]);
    const [loading, setLoading] = useState(true);
    const [editorOpportunity, setEditorOpportunity] = useState<ClientOpportunity | null | undefined>(undefined);
    const [timelineOpportunity, setTimelineOpportunity] = useState<ClientOpportunity | null>(null);

    const loadOpportunities = useCallback(async () => {
        try {
            setLoading(true);
            setOpportunities(await ClientService.getClientOpportunities(client.id));
        } catch (error) {
            toast.error(getErrorMessage(error, copy.load_error));
        } finally {
            setLoading(false);
        }
    }, [client.id, copy.load_error]);

    useEffect(() => {
        const timeoutId = window.setTimeout(() => void loadOpportunities(), 0);
        return () => window.clearTimeout(timeoutId);
    }, [loadOpportunities]);

    if (loading) {
        return <div className="flex min-h-48 items-center justify-center text-sm text-[var(--text-muted)]"><Loader2 className="mr-2 size-4 animate-spin" />{dict.clients.details.loading}</div>;
    }

    return (
        <section className="space-y-4">
            <header className="flex flex-col gap-3 rounded-2xl border border-[var(--border-soft)] bg-[var(--bg-primary)]/45 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h3 className="text-base font-semibold text-[var(--text-main)]">{copy.title}</h3>
                    <p className="mt-1 text-sm text-[var(--text-muted)]">{copy.description}</p>
                </div>
                {canManage && <Button type="button" onClick={() => setEditorOpportunity(null)}><Plus className="size-4" />{copy.new}</Button>}
            </header>

            {opportunities.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-[var(--border-soft)] bg-[var(--bg-primary)]/30 px-5 py-12 text-center">
                    <ClipboardList className="mx-auto size-5 text-accent" />
                    <h4 className="mt-3 text-sm font-semibold text-[var(--text-main)]">{copy.empty_title}</h4>
                    <p className="mt-1 text-sm text-[var(--text-muted)]">{copy.empty_description}</p>
                </div>
            ) : (
                <div className="grid gap-3 xl:grid-cols-2">
                    {opportunities.map((opportunity) => (
                        <OpportunityCard
                            key={opportunity.id}
                            opportunity={opportunity}
                            stageLabel={copy.stages[opportunity.stage]}
                            followUpLabel={formatDate(opportunity.next_follow_up_at, locale)}
                            ownerFallback={copy.unassigned}
                            timelineLabel={copy.timeline}
                            editLabel={copy.edit}
                            canManage={canManage}
                            onOpenTimeline={() => setTimelineOpportunity(opportunity)}
                            onEdit={() => setEditorOpportunity(opportunity)}
                        />
                    ))}
                </div>
            )}

            {editorOpportunity !== undefined && (
                <OpportunityEditorDialog
                    client={client}
                    opportunity={editorOpportunity}
                    onOpenChange={(open) => !open && setEditorOpportunity(undefined)}
                    onSaved={async () => {
                        setEditorOpportunity(undefined);
                        await loadOpportunities();
                    }}
                />
            )}
            {timelineOpportunity && (
                <ClientOpportunityTimelineDialog
                    clientId={client.id}
                    opportunity={timelineOpportunity}
                    canManage={canManage}
                    onOpenChange={(open) => !open && setTimelineOpportunity(null)}
                />
            )}
        </section>
    );
}

function OpportunityCard({
    opportunity,
    stageLabel,
    followUpLabel,
    ownerFallback,
    timelineLabel,
    editLabel,
    canManage,
    onOpenTimeline,
    onEdit,
}: {
    opportunity: ClientOpportunity;
    stageLabel: string;
    followUpLabel: string | null;
    ownerFallback: string;
    timelineLabel: string;
    editLabel: string;
    canManage: boolean;
    onOpenTimeline: () => void;
    onEdit: () => void;
}) {
    return (
        <article className="rounded-2xl border border-[var(--border-soft)] bg-[var(--bg-primary)]/40 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                    <h4 className="text-sm font-semibold text-[var(--text-main)]">{opportunity.title}</h4>
                    <p className="mt-1 flex items-center gap-1.5 text-sm text-[var(--text-muted)]"><UserRound className="size-3.5" />{opportunity.owner_name || ownerFallback}</p>
                </div>
                <StageBadge stage={opportunity.stage}>{stageLabel}</StageBadge>
            </div>
            {followUpLabel && <p className="mt-4 flex items-center gap-2 rounded-xl bg-[var(--bg-tertiary)]/70 px-3 py-2 text-xs font-medium text-[var(--text-muted)]"><CalendarClock className="size-3.5 text-accent" />{followUpLabel}</p>}
            <div className="mt-4 flex flex-wrap justify-end gap-2 border-t border-[var(--border-soft)] pt-3">
                <Button type="button" variant="outline" size="sm" onClick={onOpenTimeline}><ClipboardList className="size-3.5" />{timelineLabel}</Button>
                {canManage && <Button type="button" variant="outline" size="sm" onClick={onEdit}><Pencil className="size-3.5" />{editLabel}</Button>}
            </div>
        </article>
    );
}

function StageBadge({ stage, children }: { stage: ClientOpportunityStage; children: string }) {
    return <Badge className={stageBadgeClassNames[stage]}>{children}</Badge>;
}

function OpportunityEditorDialog({
    client,
    opportunity,
    onOpenChange,
    onSaved,
}: {
    client: Client;
    opportunity: ClientOpportunity | null;
    onOpenChange: (open: boolean) => void;
    onSaved: () => Promise<void>;
}) {
    const { dict } = useDictionary();
    const copy = dict.clients.opportunities;
    const [draft, setDraft] = useState<ClientOpportunityPayload>(() => draftFromOpportunity(opportunity ?? undefined));
    const [contacts, setContacts] = useState<ClientContact[]>([]);
    const [owners, setOwners] = useState<ClientOpportunityOwner[]>([]);
    const [loadingOptions, setLoadingOptions] = useState(true);
    const [saving, setSaving] = useState(false);
    const editing = opportunity !== null;

    useEffect(() => {
        const timeoutId = window.setTimeout(() => {
            void Promise.all([ClientService.getClientContacts(client.id), ClientService.getClientOpportunityOwners(client.id)])
                .then(([loadedContacts, loadedOwners]) => {
                    setContacts(loadedContacts.filter((contact) => contact.is_active));
                    setOwners(loadedOwners);
                })
                .catch((error) => toast.error(getErrorMessage(error, copy.load_options_error)))
                .finally(() => setLoadingOptions(false));
        }, 0);
        return () => window.clearTimeout(timeoutId);
    }, [client.id, copy.load_options_error]);

    const submit = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        const payload: ClientOpportunityPayload = {
            ...draft,
            title: draft.title.trim(),
            loss_reason: draft.stage === "lost" ? draft.loss_reason?.trim() || null : null,
        };
        try {
            setSaving(true);
            if (editing) {
                await ClientService.updateClientOpportunity(client.id, opportunity.id, payload);
            } else {
                await ClientService.createClientOpportunity(client.id, payload);
            }
            toast.success(editing ? copy.update_success : copy.create_success);
            await onSaved();
        } catch (error) {
            toast.error(getErrorMessage(error, copy.save_error));
        } finally {
            setSaving(false);
        }
    };

    return (
        <Dialog open onOpenChange={onOpenChange}>
            <DialogContent className="flex max-h-[92vh] max-w-[calc(100%-1rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl">
                <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col">
                    <DialogHeader className="shrink-0 border-b border-[var(--border-soft)] px-5 py-5 text-left sm:px-6">
                        <DialogTitle>{editing ? copy.edit : copy.new}</DialogTitle>
                        <DialogDescription>{copy.editor_description}</DialogDescription>
                    </DialogHeader>
                    <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6">
                        {loadingOptions ? (
                            <div className="flex min-h-48 items-center justify-center text-sm text-[var(--text-muted)]"><Loader2 className="mr-2 size-4 animate-spin" />{copy.loading_options}</div>
                        ) : (
                            <FieldGroup className="gap-5">
                                <Field>
                                    <FieldLabel htmlFor="opportunity-title">{copy.title_label}</FieldLabel>
                                    <FieldContent><Input id="opportunity-title" required value={draft.title} onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))} /></FieldContent>
                                </Field>
                                <div className="grid gap-4 sm:grid-cols-2">
                                    <SelectField label={copy.stage_label} value={draft.stage} onValueChange={(value) => setDraft((current) => ({ ...current, stage: value as ClientOpportunityStage }))}>
                                        {stages.map((stage) => <SelectItem key={stage} value={stage}>{copy.stages[stage]}</SelectItem>)}
                                    </SelectField>
                                    <SelectField label={copy.owner_label} value={draft.owner_membership_id ? String(draft.owner_membership_id) : "unassigned"} onValueChange={(value) => setDraft((current) => ({ ...current, owner_membership_id: value === "unassigned" ? null : Number(value) }))}>
                                        <SelectItem value="unassigned">{copy.unassigned}</SelectItem>
                                        {owners.map((owner) => <SelectItem key={owner.membership_id} value={String(owner.membership_id)}>{owner.full_name}</SelectItem>)}
                                    </SelectField>
                                    <SelectField label={copy.contact_label} value={draft.contact_id ? String(draft.contact_id) : "no-contact"} onValueChange={(value) => setDraft((current) => ({ ...current, contact_id: value === "no-contact" ? null : Number(value) }))}>
                                        <SelectItem value="no-contact">{copy.no_contact}</SelectItem>
                                        {contacts.map((contact) => <SelectItem key={contact.id} value={String(contact.id)}>{contact.full_name}</SelectItem>)}
                                    </SelectField>
                                    <Field>
                                        <FieldLabel htmlFor="opportunity-follow-up">{copy.next_follow_up_label}</FieldLabel>
                                        <FieldContent><DateTimePicker id="opportunity-follow-up" value={draft.next_follow_up_at} onValueChange={(next_follow_up_at) => setDraft((current) => ({ ...current, next_follow_up_at }))} /></FieldContent>
                                    </Field>
                                </div>
                                {draft.stage === "lost" && <Field>
                                    <FieldLabel htmlFor="opportunity-loss-reason">{copy.loss_reason_label}</FieldLabel>
                                    <FieldContent><Input id="opportunity-loss-reason" required value={draft.loss_reason ?? ""} onChange={(event) => setDraft((current) => ({ ...current, loss_reason: event.target.value }))} /></FieldContent>
                                </Field>}
                            </FieldGroup>
                        )}
                    </div>
                    <DialogFooter className="shrink-0 border-t border-[var(--border-soft)] px-5 py-4 sm:px-6">
                        <Button type="button" variant="cancel" onClick={() => onOpenChange(false)}>{copy.cancel}</Button>
                        <Button type="submit" disabled={saving || loadingOptions}>{saving && <Loader2 className="size-4 animate-spin" />}{saving ? copy.saving : copy.save}</Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}

function SelectField({ label, value, onValueChange, children }: { label: string; value: string; onValueChange: (value: string) => void; children: React.ReactNode }) {
    return <Field><FieldLabel>{label}</FieldLabel><FieldContent><Select value={value} onValueChange={onValueChange}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{children}</SelectContent></Select></FieldContent></Field>;
}
