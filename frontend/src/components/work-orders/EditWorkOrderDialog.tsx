"use client";

import * as React from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DateTimePicker } from "@/components/ui/date-time-picker";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { getErrorMessage } from "@/lib/errors";
import { useDictionary } from "@/lib/dictionary-context";
import { toast } from "@/lib/toast";
import { WorkOrderService } from "@/services/work-order.service";
import type { WorkOrder, WorkOrderUpdate } from "@/types/work-order";
import { toDateTimeInput, workOrderStatusCopy } from "./work-order-form";

type WorkOrderUpdateDraft = {
    title: string;
    description: string;
    status: WorkOrder["status"];
    scheduledStart: string;
    recurrenceUnit: "weekly" | "monthly";
    recurrenceInterval: string;
    recurrenceEndsAt: string;
    estimatedPeople: string;
    estimatedMinutes: string;
};

function createWorkOrderUpdateDraft(workOrder: WorkOrder): WorkOrderUpdateDraft {
    return {
        title: workOrder.title,
        description: workOrder.description ?? "",
        status: workOrder.status,
        scheduledStart: toDateTimeInput(new Date(
            workOrder.order_type === "recurring"
                ? workOrder.next_occurrence_at ?? workOrder.scheduled_start_at
                : workOrder.scheduled_start_at,
        )),
        recurrenceUnit: workOrder.recurrence_unit ?? "weekly",
        recurrenceInterval: String(workOrder.recurrence_interval ?? 1),
        recurrenceEndsAt: workOrder.recurrence_ends_at ? toDateTimeInput(new Date(workOrder.recurrence_ends_at)) : "",
        estimatedPeople: workOrder.estimated_people?.toString() ?? "",
        estimatedMinutes: workOrder.estimated_minutes?.toString() ?? "",
    };
}

export function EditWorkOrderDialog({ workOrder, open, onOpenChange, onUpdated, readOnly = false }: {
    workOrder: WorkOrder;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onUpdated: (workOrder: WorkOrder) => void;
    readOnly?: boolean;
}) {
    const { dict } = useDictionary();
    const [saving, setSaving] = React.useState(false);
    const [draft, setDraft] = React.useState<WorkOrderUpdateDraft>(() => createWorkOrderUpdateDraft(workOrder));
    const updateDraft = (changes: Partial<WorkOrderUpdateDraft>) => setDraft((current) => ({ ...current, ...changes }));

    const save = async () => {
        if (readOnly) return;
        if (!draft.title.trim() || !draft.scheduledStart) {
            toast.error("Completa el nombre y la próxima planificación.");
            return;
        }
        const original = createWorkOrderUpdateDraft(workOrder);
        const payload: WorkOrderUpdate = {
            title: draft.title.trim(),
            description: draft.description.trim() || null,
            status: draft.status,
            estimated_people: draft.estimatedPeople ? Number(draft.estimatedPeople) : null,
            estimated_minutes: draft.estimatedMinutes ? Number(draft.estimatedMinutes) : null,
            ...(workOrder.order_type === "recurring" ? {
                ...(draft.scheduledStart !== original.scheduledStart ? { next_occurrence_at: new Date(draft.scheduledStart).toISOString() } : {}),
                recurrence_unit: draft.recurrenceUnit,
                recurrence_interval: Number(draft.recurrenceInterval),
                ...(draft.recurrenceEndsAt !== original.recurrenceEndsAt ? { recurrence_ends_at: draft.recurrenceEndsAt ? new Date(draft.recurrenceEndsAt).toISOString() : null } : {}),
            } : draft.scheduledStart !== original.scheduledStart ? { scheduled_start_at: new Date(draft.scheduledStart).toISOString() } : {}),
        };
        setSaving(true);
        try {
            const updated = await WorkOrderService.updateWorkOrder(workOrder.id, payload);
            onUpdated(updated);
            toast.success("Orden de trabajo actualizada.");
            onOpenChange(false);
        } catch (error) {
            toast.error(getErrorMessage(error, "No se pudo actualizar la orden de trabajo."));
        } finally {
            setSaving(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent compact className="flex max-w-xl flex-col gap-0 overflow-hidden p-0" confirmDiscard={!readOnly}>
                <DialogHeader className="shrink-0 border-b border-[var(--border-soft)] p-5 pr-14 text-left">
                    <DialogTitle>{readOnly ? dict.workOrderValidation.details : "Editar orden de trabajo"}</DialogTitle>
                    <DialogDescription>{readOnly ? dict.workOrderValidation.read_only_hint : "La ubicación y el contrato mantienen su trazabilidad; aquí ajustas la planificación y el estado operativo."}</DialogDescription>
                </DialogHeader>
                {readOnly && <p className="shrink-0 px-5 pt-4 text-xs font-semibold text-[var(--text-muted)]">{dict.workOrderValidation.read_only}</p>}
                <div className="min-h-0 flex-1 overflow-y-auto">
                <fieldset disabled={readOnly} className={`grid min-w-0 gap-4 p-5 ${readOnly ? "[&_input]:disabled:opacity-100 [&_textarea]:disabled:opacity-100 [&_button]:disabled:opacity-100" : ""}`}>
                    <div className="grid gap-2">
                        <Label htmlFor="work-order-edit-title">Nombre</Label>
                        <Input id="work-order-edit-title" value={draft.title} onChange={event => updateDraft({ title: event.target.value })} maxLength={160} />
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="work-order-edit-status">Estado operativo</Label>
                        <Select value={draft.status} onValueChange={value => updateDraft({ status: value as WorkOrder["status"] })}>
                            <SelectTrigger id="work-order-edit-status"><SelectValue /></SelectTrigger>
                            <SelectContent>{Object.entries(workOrderStatusCopy).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent>
                        </Select>
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="work-order-edit-scheduled">Próxima planificación</Label>
                        <DateTimePicker id="work-order-edit-scheduled" aria-label="Próxima planificación" value={draft.scheduledStart} onValueChange={scheduledStart => updateDraft({ scheduledStart: scheduledStart ?? "" })} />
                    </div>
                    {workOrder.order_type === "recurring" && (
                        <div className="grid min-w-0 gap-3 sm:grid-cols-2">
                            <div className="grid gap-2">
                                <Label htmlFor="work-order-edit-frequency">Frecuencia</Label>
                                <Select value={draft.recurrenceUnit} onValueChange={value => updateDraft({ recurrenceUnit: value as "weekly" | "monthly" })}>
                                    <SelectTrigger id="work-order-edit-frequency"><SelectValue /></SelectTrigger>
                                    <SelectContent><SelectItem value="weekly">Semanal</SelectItem><SelectItem value="monthly">Mensual</SelectItem></SelectContent>
                                </Select>
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="work-order-edit-interval">Cada</Label>
                                <Input id="work-order-edit-interval" type="number" min="1" max="52" value={draft.recurrenceInterval} onChange={event => updateDraft({ recurrenceInterval: event.target.value })} />
                            </div>
                            <div className="grid min-w-0 gap-2 sm:col-span-2">
                                <Label htmlFor="work-order-edit-ends">Finaliza</Label>
                                <DateTimePicker id="work-order-edit-ends" aria-label="Finaliza" value={draft.recurrenceEndsAt} min={draft.scheduledStart} clearable onValueChange={recurrenceEndsAt => updateDraft({ recurrenceEndsAt: recurrenceEndsAt ?? "" })} />
                            </div>
                        </div>
                    )}
                    <div className="grid grid-cols-2 gap-3">
                        <div className="grid gap-2"><Label htmlFor="work-order-edit-people">Personas previstas</Label><Input id="work-order-edit-people" type="number" min="1" value={draft.estimatedPeople} onChange={event => updateDraft({ estimatedPeople: event.target.value })} /></div>
                        <div className="grid gap-2"><Label htmlFor="work-order-edit-minutes">Minutos previstos</Label><Input id="work-order-edit-minutes" type="number" min="1" value={draft.estimatedMinutes} onChange={event => updateDraft({ estimatedMinutes: event.target.value })} /></div>
                    </div>
                    <div className="grid gap-2"><Label htmlFor="work-order-edit-description">Indicaciones</Label><Textarea id="work-order-edit-description" value={draft.description} onChange={event => updateDraft({ description: event.target.value })} /></div>
                </fieldset>
                </div>
                <DialogFooter className="shrink-0 border-t border-[var(--border-soft)] p-5">
                    <Button type="button" variant="cancel" onClick={() => onOpenChange(false)}>{readOnly ? dict.workOrderValidation.close : "Cancelar"}</Button>
                    {!readOnly && <Button type="button" onClick={() => void save()} disabled={saving}>{saving && <Loader2 className="size-4 animate-spin" />}Guardar cambios</Button>}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
