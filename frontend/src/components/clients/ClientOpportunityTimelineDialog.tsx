"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarDays, Loader2, Mail, MessageSquareText, Phone, Plus, UsersRound } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldContent, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useDictionary } from "@/lib/dictionary-context";
import { getErrorMessage } from "@/lib/errors";
import { toast } from "@/lib/toast";
import {
    ClientService,
    type ClientOpportunity,
    type ClientOpportunityActivity,
    type ClientOpportunityActivityType,
} from "@/services/client.service";

type ClientOpportunityTimelineDialogProps = {
    clientId: number;
    opportunity: ClientOpportunity;
    canManage: boolean;
    onOpenChange: (open: boolean) => void;
};

const manualActivityTypes: ClientOpportunityActivityType[] = ["note", "call", "email", "meeting"];
const activityIconByType = {
    note: MessageSquareText,
    call: Phone,
    email: Mail,
    meeting: UsersRound,
    stage_change: CalendarDays,
};

export function ClientOpportunityTimelineDialog({ clientId, opportunity, canManage, onOpenChange }: ClientOpportunityTimelineDialogProps) {
    const { dict, locale } = useDictionary();
    const copy = dict.clients.opportunities;
    const [activities, setActivities] = useState<ClientOpportunityActivity[]>([]);
    const [loading, setLoading] = useState(true);
    const [activityType, setActivityType] = useState<ClientOpportunityActivityType>("note");
    const [body, setBody] = useState("");
    const [saving, setSaving] = useState(false);

    const loadActivities = useCallback(async () => {
        try {
            setLoading(true);
            setActivities(await ClientService.getClientOpportunityActivities(clientId, opportunity.id));
        } catch (error) {
            toast.error(getErrorMessage(error, copy.activity_load_error));
        } finally {
            setLoading(false);
        }
    }, [clientId, copy.activity_load_error, opportunity.id]);

    useEffect(() => {
        const timeoutId = window.setTimeout(() => void loadActivities(), 0);
        return () => window.clearTimeout(timeoutId);
    }, [loadActivities]);

    const addActivity = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        try {
            setSaving(true);
            await ClientService.createClientOpportunityActivity(clientId, opportunity.id, {
                activity_type: activityType,
                body: body.trim(),
            });
            setBody("");
            await loadActivities();
            toast.success(copy.activity_success);
        } catch (error) {
            toast.error(getErrorMessage(error, copy.activity_save_error));
        } finally {
            setSaving(false);
        }
    };

    return (
        <Dialog open onOpenChange={onOpenChange}>
            <DialogContent className="flex max-h-[92vh] max-w-[calc(100%-1rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl">
                <DialogHeader className="shrink-0 border-b border-[var(--border-soft)] px-5 py-5 text-left sm:px-6">
                    <DialogTitle>{copy.timeline}: {opportunity.title}</DialogTitle>
                    <DialogDescription>{copy.timeline_description}</DialogDescription>
                </DialogHeader>
                <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6">
                    {canManage && <form className="rounded-2xl border border-[var(--border-soft)] bg-[var(--bg-primary)]/35 p-4" onSubmit={addActivity}>
                        <FieldGroup className="gap-3">
                            <div className="grid gap-3 sm:grid-cols-[11rem_minmax(0,1fr)]">
                                <Field>
                                    <FieldLabel>{copy.activity_type_label}</FieldLabel>
                                    <FieldContent><Select value={activityType} onValueChange={(value) => setActivityType(value as ClientOpportunityActivityType)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{manualActivityTypes.map((type) => <SelectItem key={type} value={type}>{copy.activity_types[type]}</SelectItem>)}</SelectContent></Select></FieldContent>
                                </Field>
                                <Field>
                                    <FieldLabel htmlFor="opportunity-activity">{copy.activity_body_label}</FieldLabel>
                                    <FieldContent><Textarea id="opportunity-activity" required value={body} onChange={(event) => setBody(event.target.value)} className="min-h-20 resize-y" /></FieldContent>
                                </Field>
                            </div>
                            <div className="flex justify-end"><Button type="submit" size="sm" disabled={saving || !body.trim()}>{saving && <Loader2 className="size-3.5 animate-spin" />}<Plus className="size-3.5" />{copy.add_activity}</Button></div>
                        </FieldGroup>
                    </form>}

                    {loading ? (
                        <div className="flex min-h-40 items-center justify-center text-sm text-[var(--text-muted)]"><Loader2 className="mr-2 size-4 animate-spin" />{copy.loading_timeline}</div>
                    ) : activities.length === 0 ? (
                        <p className="py-10 text-center text-sm text-[var(--text-muted)]">{copy.timeline_empty}</p>
                    ) : (
                        <ol className="mt-5 space-y-3">
                            {activities.map((activity) => <TimelineEntry key={activity.id} activity={activity} labels={copy} locale={locale} />)}
                        </ol>
                    )}
                </div>
                <DialogFooter className="dialog-glass-chrome shrink-0 border-t border-[var(--border-soft)] px-5 py-4 sm:px-6">
                    <Button type="button" variant="outline" className="btn-cancel-muted" onClick={() => onOpenChange(false)}>{copy.close}</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

function TimelineEntry({ activity, labels, locale }: { activity: ClientOpportunityActivity; labels: ReturnType<typeof useDictionary>["dict"]["clients"]["opportunities"]; locale: string }) {
    const dateFormatter = useMemo(
        () => new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }),
        [locale],
    );
    const happenedAt = useMemo(() => {
        const date = new Date(activity.happened_at);
        return Number.isNaN(date.getTime()) ? activity.happened_at : dateFormatter.format(date);
    }, [activity.happened_at, dateFormatter]);
    const Icon = activityIconByType[activity.activity_type];
    const title = activity.activity_type === "stage_change"
        ? labels.stage_change.replace("{from}", labels.stages[activity.stage_from ?? "new"]).replace("{to}", labels.stages[activity.stage_to ?? "new"])
        : labels.activity_types[activity.activity_type];
    return (
        <li className="flex gap-3 rounded-2xl border border-[var(--border-soft)] bg-[var(--bg-primary)]/30 p-3.5">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-[var(--btn-secondary-bg)] text-[var(--btn-secondary-text)]"><Icon className="size-4" /></span>
            <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                    <p className="text-sm font-semibold text-[var(--text-main)]">{title}</p>
                    <time className="text-xs text-[var(--text-muted)]">{happenedAt}</time>
                </div>
                {activity.body && <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-[var(--text-muted)]">{activity.body}</p>}
                {activity.actor_name && <p className="mt-2 text-xs text-[var(--text-muted)]">{labels.by_actor.replace("{name}", activity.actor_name)}</p>}
            </div>
        </li>
    );
}
