"use client";

import * as React from "react";
import { CalendarPlus, ClipboardList, Loader2, MapPin, Plus, Repeat2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataListTable } from "@/components/ui/data-list-table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/ui/page-header";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { formatDate } from "@/lib/format";
import { getErrorMessage } from "@/lib/errors";
import { PAGE_ACTION_BUTTON_PRIMARY } from "@/lib/page-action-button";
import { toast } from "@/lib/toast";
import { LocationService, type Location } from "@/services/location.service";
import { WorkOrderService } from "@/services/work-order.service";
import type { WorkOrder, WorkOrderContractCandidate, WorkOrderCreate, WorkOrderType } from "@/types/work-order";

const statusCopy = {
    draft: "Borrador",
    active: "Activa",
    paused: "Pausada",
    completed: "Finalizada",
    cancelled: "Cancelada",
} as const;

const toDateTimeInput = (value = new Date()) => {
    const offset = value.getTimezoneOffset() * 60_000;
    return new Date(value.getTime() - offset).toISOString().slice(0, 16);
};

function CreateWorkOrderDialog({
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
    const [saving, setSaving] = React.useState(false);
    const [title, setTitle] = React.useState("");
    const [description, setDescription] = React.useState("");
    const [locationId, setLocationId] = React.useState("");
    const [contractKey, setContractKey] = React.useState("");
    const [orderType, setOrderType] = React.useState<WorkOrderType>("one_off");
    const [scheduledStart, setScheduledStart] = React.useState(() => toDateTimeInput());
    const [recurrenceUnit, setRecurrenceUnit] = React.useState<"weekly" | "monthly">("weekly");
    const [recurrenceInterval, setRecurrenceInterval] = React.useState("1");
    const [estimatedPeople, setEstimatedPeople] = React.useState("");
    const [estimatedMinutes, setEstimatedMinutes] = React.useState("");

    const reset = () => {
        setTitle("");
        setDescription("");
        setLocationId("");
        setContractKey("");
        setOrderType("one_off");
        setScheduledStart(toDateTimeInput());
        setRecurrenceUnit("weekly");
        setRecurrenceInterval("1");
        setEstimatedPeople("");
        setEstimatedMinutes("");
    };

    const selectedContract = contracts.find((candidate) => String(candidate.contract_id) === contractKey);
    const save = async () => {
        const selectedLocationId = selectedContract?.location_id ?? Number(locationId);
        if (!title.trim() || !Number.isSafeInteger(selectedLocationId) || !scheduledStart) {
            toast.error("Completa el nombre, la ubicación y la primera ejecución.");
            return;
        }
        const payload: WorkOrderCreate = {
            title: title.trim(),
            description: description.trim() || undefined,
            location_id: selectedLocationId,
            service_contract_id: selectedContract?.contract_id,
            status: "active",
            order_type: orderType,
            scheduled_start_at: new Date(scheduledStart).toISOString(),
            estimated_people: estimatedPeople ? Number(estimatedPeople) : undefined,
            estimated_minutes: estimatedMinutes ? Number(estimatedMinutes) : undefined,
            ...(orderType === "recurring" ? {
                recurrence_unit: recurrenceUnit,
                recurrence_interval: Number(recurrenceInterval),
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
            <DialogContent compact className="max-w-xl" confirmDiscard>
                <DialogHeader>
                    <DialogTitle>Nueva orden de trabajo</DialogTitle>
                    <DialogDescription>Planifica una intervención sin crear todavía una tarea ejecutable.</DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-2">
                    <div className="grid gap-2"><Label htmlFor="work-order-title">Nombre</Label><Input id="work-order-title" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Ej. Limpieza semanal de oficinas" maxLength={160} /></div>
                    <div className="grid gap-2"><Label htmlFor="work-order-contract">Contrato activo (opcional)</Label><Select value={contractKey} onValueChange={(value) => { setContractKey(value); const candidate = contracts.find((item) => String(item.contract_id) === value); if (candidate) setLocationId(String(candidate.location_id)); }}><SelectTrigger id="work-order-contract"><SelectValue placeholder="Sin contrato" /></SelectTrigger><SelectContent><SelectItem value="none">Sin contrato</SelectItem>{contracts.map((contract) => <SelectItem key={`${contract.contract_id}:${contract.location_id}`} value={String(contract.contract_id)}>{contract.contract_title} · {contract.location_name}</SelectItem>)}</SelectContent></Select></div>
                    <div className="grid gap-2"><Label htmlFor="work-order-location">Ubicación</Label><Select value={selectedContract ? String(selectedContract.location_id) : locationId} onValueChange={setLocationId} disabled={Boolean(selectedContract)}><SelectTrigger id="work-order-location"><SelectValue placeholder="Selecciona una ubicación" /></SelectTrigger><SelectContent>{locations.filter((location) => location.can_manage_tasks).map((location) => <SelectItem key={location.id} value={String(location.id)}>{location.name}</SelectItem>)}</SelectContent></Select></div>
                    <div className="grid gap-2"><Label htmlFor="work-order-scheduled">Primera ejecución</Label><Input id="work-order-scheduled" type="datetime-local" value={scheduledStart} onChange={(event) => setScheduledStart(event.target.value)} /></div>
                    <div className="grid gap-2"><Label>Tipo</Label><Select value={orderType} onValueChange={(value) => setOrderType(value as WorkOrderType)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="one_off">Una sola vez</SelectItem><SelectItem value="recurring">Recurrente</SelectItem></SelectContent></Select></div>
                    {orderType === "recurring" && <div className="grid grid-cols-2 gap-3"><div className="grid gap-2"><Label>Frecuencia</Label><Select value={recurrenceUnit} onValueChange={(value) => setRecurrenceUnit(value as "weekly" | "monthly")}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="weekly">Semanal</SelectItem><SelectItem value="monthly">Mensual</SelectItem></SelectContent></Select></div><div className="grid gap-2"><Label htmlFor="work-order-interval">Cada</Label><Input id="work-order-interval" type="number" min="1" max="52" value={recurrenceInterval} onChange={(event) => setRecurrenceInterval(event.target.value)} /></div></div>}
                    <div className="grid grid-cols-2 gap-3"><div className="grid gap-2"><Label htmlFor="work-order-people">Personas previstas</Label><Input id="work-order-people" type="number" min="1" value={estimatedPeople} onChange={(event) => setEstimatedPeople(event.target.value)} /></div><div className="grid gap-2"><Label htmlFor="work-order-minutes">Minutos previstos</Label><Input id="work-order-minutes" type="number" min="1" value={estimatedMinutes} onChange={(event) => setEstimatedMinutes(event.target.value)} /></div></div>
                    <div className="grid gap-2"><Label htmlFor="work-order-description">Indicaciones</Label><Textarea id="work-order-description" value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Información operativa para la tarea que se genere." /></div>
                </div>
                <DialogFooter><Button type="button" variant="cancel" onClick={() => onOpenChange(false)}>Cancelar</Button><Button type="button" onClick={() => void save()} disabled={saving}>{saving && <Loader2 className="size-4 animate-spin" />}Crear orden</Button></DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

export default function WorkOrdersPage() {
    const [workOrders, setWorkOrders] = React.useState<WorkOrder[]>([]);
    const [locations, setLocations] = React.useState<Location[]>([]);
    const [contracts, setContracts] = React.useState<WorkOrderContractCandidate[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [creating, setCreating] = React.useState(false);
    const [generatingId, setGeneratingId] = React.useState<number | null>(null);

    const reload = React.useCallback(async () => {
        setLoading(true);
        try {
            const [orders, nextLocations, candidates] = await Promise.all([
                WorkOrderService.getWorkOrders(),
                LocationService.getLocations(),
                WorkOrderService.getContractCandidates(),
            ]);
            setWorkOrders(orders);
            setLocations(nextLocations);
            setContracts(candidates);
        } catch (error) {
            toast.error(getErrorMessage(error, "No se pudieron cargar las órdenes de trabajo."));
        } finally {
            setLoading(false);
        }
    }, []);

    React.useEffect(() => {
        const timer = window.setTimeout(() => void reload(), 0);
        return () => window.clearTimeout(timer);
    }, [reload]);

    const locationName = (id: number) => locations.find((location) => location.id === id)?.name ?? `Ubicación #${id}`;
    const generate = async (workOrder: WorkOrder) => {
        setGeneratingId(workOrder.id);
        try {
            const result = await WorkOrderService.generateTask(workOrder.id);
            setWorkOrders((current) => current.map((item) => item.id === workOrder.id ? result.work_order : item));
            toast.success("Tarea ejecutable creada desde la orden.");
        } catch (error) {
            toast.error(getErrorMessage(error, "No se pudo generar la tarea."));
        } finally {
            setGeneratingId(null);
        }
    };

    return <div className="dashboard-page-content px-[3%] py-6 md:p-8">
        <PageHeader icon={ClipboardList} title="Órdenes de trabajo" subtitle="Planifica una intervención o recurrencia. Las tareas se crean solo cuando generas una ejecución." className="mb-6" actions={<Button className={PAGE_ACTION_BUTTON_PRIMARY} onClick={() => setCreating(true)}><Plus className="size-4" />Nueva orden</Button>} />
        <DataListTable
            items={workOrders}
            getRowKey={(order) => order.id}
            loading={loading}
            desktopFrom="lg"
            header={{ title: "Planificación operativa", subtitle: "Una orden organiza el trabajo; una tarea registra la ejecución real.", countLabel: `${workOrders.length} órdenes` }}
            columns={[{ key: "title", label: "Orden", className: "w-[30%]" }, { key: "location", label: "Ubicación", className: "w-[20%]" }, { key: "next", label: "Próxima ejecución", className: "w-[18%]" }, { key: "type", label: "Tipo", className: "w-[12%]" }, { key: "status", label: "Estado", className: "w-[10%]" }, { key: "actions", label: "", className: "w-[10%] text-right" }]}
            renderDesktopRow={(order) => [<div key="title" className="min-w-0"><p className="truncate text-sm font-semibold text-[var(--text-main)]">{order.title}</p><p className="mt-0.5 truncate text-xs text-[var(--text-muted)]">{order.service_contract_id ? "Contrato vinculado" : "Orden independiente"}</p></div>, <div key="location" className="flex min-w-0 items-center gap-2 text-sm text-[var(--text-main)]"><MapPin className="size-4 shrink-0 text-accent" /><span className="truncate">{locationName(order.location_id)}</span></div>, <p key="next" className="text-sm text-[var(--text-main)]">{order.next_occurrence_at ? formatDate(order.next_occurrence_at) : "—"}</p>, <div key="type"><Badge variant="secondary">{order.order_type === "recurring" ? <><Repeat2 className="mr-1 size-3" />Recurrente</> : "Puntual"}</Badge></div>, <div key="status"><Badge variant={order.status === "active" ? "default" : "secondary"}>{statusCopy[order.status]}</Badge></div>, <div key="actions" className="flex justify-end">{order.status === "active" && order.next_occurrence_at && <Button type="button" size="sm" variant="secondary" onClick={(event) => { event.stopPropagation(); void generate(order); }} disabled={generatingId === order.id}>{generatingId === order.id ? <Loader2 className="size-4 animate-spin" /> : <CalendarPlus className="size-4" />}Generar</Button>}</div> ]}
            renderCompactRow={(order) => <div className="min-w-0"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="truncate text-sm font-semibold text-[var(--text-main)]">{order.title}</p><p className="mt-1 flex items-center gap-1.5 truncate text-xs text-[var(--text-muted)]"><MapPin className="size-3.5" />{locationName(order.location_id)}</p></div><Badge variant={order.status === "active" ? "default" : "secondary"}>{statusCopy[order.status]}</Badge></div><div className="mt-3 flex items-center justify-between gap-3 border-t border-[var(--table-divider)] pt-3"><span className="text-xs text-[var(--text-muted)]">{order.next_occurrence_at ? formatDate(order.next_occurrence_at) : "Sin ejecución pendiente"}</span>{order.status === "active" && order.next_occurrence_at && <Button type="button" size="sm" variant="secondary" onClick={() => void generate(order)} disabled={generatingId === order.id}>Generar tarea</Button>}</div></div>}
            empty={<div><ClipboardList className="mx-auto mb-3 size-10 text-[var(--text-muted)] opacity-50" /><p className="text-sm font-medium text-[var(--text-muted)]">Crea una orden para planificar el próximo trabajo.</p></div>}
        />
        <CreateWorkOrderDialog open={creating} onOpenChange={setCreating} locations={locations} contracts={contracts} onCreated={(workOrder) => setWorkOrders((current) => [workOrder, ...current])} />
    </div>;
}
