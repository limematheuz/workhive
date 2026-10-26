"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarDays, Loader2, Mail, MessageSquareText, Phone, UsersRound } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useDialogDismiss } from "@/components/ui/dialog-form-guard";
import { useDictionary } from "@/lib/dictionary-context";
import { getErrorMessage } from "@/lib/errors";
import { toast } from "@/lib/toast";
import {
    ClientService,
    type ClientOpportunity,
    type ClientOpportunityActivity,
} from "@/services/client.service";

import { ClientOpportunityActivityForm } from "./ClientOpportunityActivityForm";

type ClientOpportunityTimelineDialogProps = {
    clientId: number;
    opportunity: ClientOpportunity;
    canManage: boolean;
    onOpenChange: (open: boolean) => void;
};

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

    return (
        <Dialog open onOpenChange={onOpenChange}>
            <DialogContent className="flex max-h-[92vh] max-w-[calc(100%-1rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl">
                <DialogHeader className="shrink-0 border-b border-[var(--border-soft)] px-5 py-5 text-left sm:px-6">
                    <DialogTitle>{copy.timeline}: {opportunity.title}</DialogTitle>
                    <DialogDescription>{copy.timeline_description}</DialogDescription>
                </DialogHeader>
                <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6">
                    {canManage && <ClientOpportunityActivityForm clientId={clientId} opportunityId={opportunity.id} onCreated={loadActivities} />}

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
                <DialogFooter className="shrink-0 border-t border-[var(--border-soft)] px-5 py-4 sm:px-6">
                    <TimelineCloseButton label={copy.close} onClose={() => onOpenChange(false)} />
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

function TimelineCloseButton({ label, onClose }: { label: string; onClose: () => void }) {
    const dismiss = useDialogDismiss(onClose);
    return <Button type="button" variant="cancel" onClick={dismiss}>{label}</Button>;
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
