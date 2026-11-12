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
import { useDictionary } from "@/lib/dictionary-context";
import { getErrorMessage } from "@/lib/errors";
import { toast } from "@/lib/toast";
import type { Location } from "@/services/location.service";
import { WorkOrderService } from "@/services/work-order.service";
import type { WorkOrder, WorkOrderContractCandidate, WorkOrderCreate, WorkOrderType } from "@/types/work-order";
import { toDateTimeInput } from "./work-order-form";

type WorkOrderDraft = {
    title: string;
    description: string;
    locationId: string;
    contractKey: string;
    orderType: WorkOrderType;
    scheduledStart: string;
    recurrenceUnit: "weekly" | "monthly";
    recurrenceInterval: string;
    estimatedPeople: string;
    estimatedMinutes: string;
};

function createWorkOrderDraft(): WorkOrderDraft {
    return {
        title: "",
        description: "",
        locationId: "",
        contractKey: "",
        orderType: "one_off",
        scheduledStart: toDateTimeInput(),
        recurrenceUnit: "weekly",
        recurrenceInterval: "1",
        estimatedPeople: "",
        estimatedMinutes: "",
    };
}

export function CreateWorkOrderDialog({
    open,
    onOpenChange,
    locations,
    contracts,
    onCreated,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    locations: Location[];
    contracts: WorkOrderContractCandidate[];
    onCreated: (workOrder: WorkOrder) => void;
}) {
    const { dict } = useDictionary();
    const [locationInvalid, setLocationInvalid] = React.useState(false);
    const locationRef = React.useRef<HTMLButtonElement>(null);
    const [saving, setSaving] = React.useState(false);
    const [draft, setDraft] = React.useState<WorkOrderDraft>(createWorkOrderDraft);
    const updateDraft = (changes: Partial<WorkOrderDraft>) => setDraft((current) => ({ ...current, ...changes }));
    const reset = () => setDraft(createWorkOrderDraft());

    const selectedContract = contracts.find((candidate) => String(candidate.contract_id) === draft.contractKey);
    const manageableLocations = React.useMemo(
        () => locations.filter((location) => location.can_manage_tasks),
        [locations],
    );
    const save = async () => {
        const selectedLocationId = selectedContract?.location_id ?? Number(draft.locationId);
        if (!manageableLocations.some(location => location.id === selectedLocationId)) {
            setLocationInvalid(true);
            locationRef.current?.focus();
            return;
        }
        if (!draft.title.trim() || !draft.scheduledStart || !Number.isFinite(new Date(draft.scheduledStart).getTime())) {
            toast.error("Completa el nombre, la ubicación y la primera ejecución.");
            return;
        }
        const payload: WorkOrderCreate = {
            title: draft.title.trim(),
            description: draft.description.trim() || undefined,
            location_id: selectedLocationId,
            service_contract_id: selectedContract?.contract_id,
            status: "active",
            order_type: draft.orderType,
            scheduled_start_at: new Date(draft.scheduledStart).toISOString(),
            estimated_people: draft.estimatedPeople ? Number(draft.estimatedPeople) : undefined,
            estimated_minutes: draft.estimatedMinutes ? Number(draft.estimatedMinutes) : undefined,
            ...(draft.orderType === "recurring" ? {
                recurrence_unit: draft.recurrenceUnit,
                recurrence_interval: Number(draft.recurrenceInterval),
            } : {}),
        };
        setSaving(true);
        try {
            const created = await WorkOrderService.createWorkOrder(payload);
            onCreated(created);
            toast.success("Orden de trabajo creada.");
            reset();
            onOpenChange(false);
        } catch (error) {
            toast.error(getErrorMessage(error, "No se pudo crear la orden de trabajo."));
        } finally {
            setSaving(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent compact className="flex max-w-xl flex-col gap-0 overflow-hidden p-0" confirmDiscard>
                <DialogHeader className="shrink-0 border-b border-[var(--border-soft)] p-5 pr-14 text-left">
                    <DialogTitle>Nueva orden de trabajo</DialogTitle>
                    <DialogDescription>Planifica una intervención sin crear todavía una tarea ejecutable.</DialogDescription>
                </DialogHeader>
                <form className="flex min-h-0 flex-1 flex-col" onSubmit={(event) => { event.preventDefault(); void save(); }}>
                <div className="grid min-h-0 gap-4 overflow-y-auto p-5">
                    <div className="grid gap-2"><Label htmlFor="work-order-title">Nombre</Label><Input id="work-order-title" required value={draft.title} onChange={(event) => updateDraft({ title: event.target.value })} placeholder="Ej. Limpieza semanal de oficinas" maxLength={160} /></div>
                    <div className="grid gap-2"><Label htmlFor="work-order-contract">Contrato activo (opcional)</Label><Select value={draft.contractKey} onValueChange={(value) => { const candidate = contracts.find((item) => String(item.contract_id) === value); updateDraft({ contractKey: value, locationId: candidate ? String(candidate.location_id) : draft.locationId }); }}><SelectTrigger id="work-order-contract"><SelectValue placeholder="Sin contrato" /></SelectTrigger><SelectContent><SelectItem value="none">Sin contrato</SelectItem>{contracts.map((contract) => <SelectItem key={`${contract.contract_id}:${contract.location_id}`} value={String(contract.contract_id)}>{contract.contract_title} · {contract.location_name}</SelectItem>)}</SelectContent></Select></div>
                    <div className="grid gap-2"><Label htmlFor="work-order-location">Ubicación</Label><Select value={selectedContract ? String(selectedContract.location_id) : draft.locationId} onValueChange={(value) => { setLocationInvalid(false); updateDraft({ locationId: value }); }} disabled={Boolean(selectedContract)}><SelectTrigger ref={locationRef} id="work-order-location" aria-invalid={locationInvalid} aria-describedby={locationInvalid ? "work-order-location-error" : undefined}><SelectValue placeholder="Selecciona una ubicación" /></SelectTrigger><SelectContent>{manageableLocations.map((location) => <SelectItem key={location.id} value={String(location.id)}>{location.name}</SelectItem>)}</SelectContent></Select>{locationInvalid && <p id="work-order-location-error" role="alert" className="text-xs text-[var(--priority-high-text)]">{dict.workOrderValidation.location_required}</p>}</div>
                    <div className="grid gap-2"><Label htmlFor="work-order-scheduled">Primera ejecución</Label><DateTimePicker id="work-order-scheduled" value={draft.scheduledStart} onValueChange={(scheduledStart) => updateDraft({ scheduledStart: scheduledStart ?? "" })} /></div>
                    <div className="grid gap-2"><Label>Tipo</Label><Select value={draft.orderType} onValueChange={(value) => updateDraft({ orderType: value as WorkOrderType })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="one_off">Una sola vez</SelectItem><SelectItem value="recurring">Recurrente</SelectItem></SelectContent></Select></div>
                    {draft.orderType === "recurring" && <div className="grid grid-cols-2 gap-3"><div className="grid gap-2"><Label>Frecuencia</Label><Select value={draft.recurrenceUnit} onValueChange={(value) => updateDraft({ recurrenceUnit: value as "weekly" | "monthly" })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="weekly">Semanal</SelectItem><SelectItem value="monthly">Mensual</SelectItem></SelectContent></Select></div><div className="grid gap-2"><Label htmlFor="work-order-interval">Cada</Label><Input id="work-order-interval" type="number" required min="1" max="52" value={draft.recurrenceInterval} onChange={(event) => updateDraft({ recurrenceInterval: event.target.value })} /></div></div>}
                    <div className="grid grid-cols-2 gap-3"><div className="grid gap-2"><Label htmlFor="work-order-people">Personas previstas</Label><Input id="work-order-people" type="number" min="1" max="1000" value={draft.estimatedPeople} onChange={(event) => updateDraft({ estimatedPeople: event.target.value })} /></div><div className="grid gap-2"><Label htmlFor="work-order-minutes">Minutos previstos</Label><Input id="work-order-minutes" type="number" min="1" max="100000" value={draft.estimatedMinutes} onChange={(event) => updateDraft({ estimatedMinutes: event.target.value })} /></div></div>
                    <div className="grid gap-2"><Label htmlFor="work-order-description">Indicaciones</Label><Textarea id="work-order-description" value={draft.description} onChange={(event) => updateDraft({ description: event.target.value })} placeholder="Información operativa para la tarea que se genere." /></div>
                </div>
                <DialogFooter className="shrink-0 border-t border-[var(--border-soft)] p-5"><Button type="button" variant="cancel" onClick={() => onOpenChange(false)}>Cancelar</Button><Button type="submit" disabled={saving}>{saving && <Loader2 className="size-4 animate-spin" />}Crear orden</Button></DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
