"use client";

import { useId, useState } from "react";
import { Loader2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useDialogFormGuardReset } from "@/components/ui/dialog-form-guard";
import { Field, FieldContent, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useDictionary } from "@/lib/dictionary-context";
import { getErrorMessage } from "@/lib/errors";
import { toast } from "@/lib/toast";
import { ClientService, type ClientOpportunityActivityType } from "@/services/client.service";

const manualActivityTypes: ClientOpportunityActivityType[] = ["note", "call", "email", "meeting"];

export function ClientOpportunityActivityForm({ clientId, opportunityId, onCreated }: {
    clientId: number;
    opportunityId: number;
    onCreated: () => Promise<void>;
}) {
    const { dict } = useDictionary();
    const copy = dict.clients.opportunities;
    const typeId = useId();
    const bodyId = useId();
    const resetDirty = useDialogFormGuardReset();
    const [activityType, setActivityType] = useState<ClientOpportunityActivityType>("note");
    const [body, setBody] = useState("");
    const [saving, setSaving] = useState(false);

    const addActivity = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (saving || !body.trim()) return;
        try {
            setSaving(true);
            await ClientService.createClientOpportunityActivity(clientId, opportunityId, {
                activity_type: activityType,
                body: body.trim(),
            });
            setBody("");
            resetDirty();
            await onCreated();
            toast.success(copy.activity_success);
        } catch (error) {
            toast.error(getErrorMessage(error, copy.activity_save_error));
        } finally {
            setSaving(false);
        }
    };

    return (
        <form className="rounded-2xl border border-[var(--border-soft)] bg-[var(--bg-primary)]/35 p-4" onSubmit={addActivity}>
            <FieldGroup className="gap-3">
                <div className="grid gap-3 sm:grid-cols-[11rem_minmax(0,1fr)]">
                    <Field>
                        <FieldLabel htmlFor={typeId}>{copy.activity_type_label}</FieldLabel>
                        <FieldContent><Select value={activityType} onValueChange={(value) => setActivityType(value as ClientOpportunityActivityType)}><SelectTrigger id={typeId}><SelectValue /></SelectTrigger><SelectContent>{manualActivityTypes.map((type) => <SelectItem key={type} value={type}>{copy.activity_types[type]}</SelectItem>)}</SelectContent></Select></FieldContent>
                    </Field>
                    <Field>
                        <FieldLabel htmlFor={bodyId}>{copy.activity_body_label}</FieldLabel>
                        <FieldContent><Textarea id={bodyId} required value={body} onChange={(event) => setBody(event.target.value)} className="min-h-20 resize-y" /></FieldContent>
                    </Field>
                </div>
                <div className="flex justify-end"><Button type="submit" size="sm" disabled={saving || !body.trim()}>{saving && <Loader2 className="size-3.5 animate-spin" />}<Plus className="size-3.5" />{copy.add_activity}</Button></div>
            </FieldGroup>
        </form>
    );
}
