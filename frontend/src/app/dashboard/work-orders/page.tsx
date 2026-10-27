"use client";

import * as React from "react";
import { ClipboardList, Loader2, Plus } from "lucide-react";

import { MarginForecastDialog } from "@/components/margin-forecast/MarginForecastDialog";
import { EditWorkOrderDialog } from "@/components/work-orders/EditWorkOrderDialog";
import { WorkOrderList } from "@/components/work-orders/WorkOrderList";
import { toDateTimeInput } from "@/components/work-orders/work-order-form";
import { WorkOrderMaterialsDialog } from "@/components/work-orders/WorkOrderMaterialsDialog";
import { Button } from "@/components/ui/button";
import { DateTimePicker } from "@/components/ui/date-time-picker";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/ui/page-header";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { getErrorMessage } from "@/lib/errors";
import { canManageFinance, canViewFinance, canViewLaborCosts, isPlatformSuperadmin } from "@/domain/access/roles";
import { PAGE_ACTION_BUTTON_PRIMARY } from "@/lib/page-action-button";
import { toast } from "@/lib/toast";
import { useUser } from "@/lib/user-context";
import { LocationService, type Location } from "@/services/location.service";
import { WorkOrderService } from "@/services/work-order.service";
import type { WorkOrder, WorkOrderContractCandidate, WorkOrderCreate, WorkOrderType } from "@/types/work-order";

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
        if (!draft.title.trim() || !Number.isSafeInteger(selectedLocationId) || !draft.scheduledStart) {
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
            <DialogContent compact className="max-w-xl" confirmDiscard>
                <DialogHeader>
                    <DialogTitle>Nueva orden de trabajo</DialogTitle>
                    <DialogDescription>Planifica una intervención sin crear todavía una tarea ejecutable.</DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-2">
                    <div className="grid gap-2"><Label htmlFor="work-order-title">Nombre</Label><Input id="work-order-title" value={draft.title} onChange={(event) => updateDraft({ title: event.target.value })} placeholder="Ej. Limpieza semanal de oficinas" maxLength={160} /></div>
                    <div className="grid gap-2"><Label htmlFor="work-order-contract">Contrato activo (opcional)</Label><Select value={draft.contractKey} onValueChange={(value) => { const candidate = contracts.find((item) => String(item.contract_id) === value); updateDraft({ contractKey: value, locationId: candidate ? String(candidate.location_id) : draft.locationId }); }}><SelectTrigger id="work-order-contract"><SelectValue placeholder="Sin contrato" /></SelectTrigger><SelectContent><SelectItem value="none">Sin contrato</SelectItem>{contracts.map((contract) => <SelectItem key={`${contract.contract_id}:${contract.location_id}`} value={String(contract.contract_id)}>{contract.contract_title} · {contract.location_name}</SelectItem>)}</SelectContent></Select></div>
                    <div className="grid gap-2"><Label htmlFor="work-order-location">Ubicación</Label><Select value={selectedContract ? String(selectedContract.location_id) : draft.locationId} onValueChange={(value) => updateDraft({ locationId: value })} disabled={Boolean(selectedContract)}><SelectTrigger id="work-order-location"><SelectValue placeholder="Selecciona una ubicación" /></SelectTrigger><SelectContent>{manageableLocations.map((location) => <SelectItem key={location.id} value={String(location.id)}>{location.name}</SelectItem>)}</SelectContent></Select></div>
                    <div className="grid gap-2"><Label htmlFor="work-order-scheduled">Primera ejecución</Label><DateTimePicker id="work-order-scheduled" value={draft.scheduledStart} onValueChange={(scheduledStart) => updateDraft({ scheduledStart: scheduledStart ?? "" })} /></div>
                    <div className="grid gap-2"><Label>Tipo</Label><Select value={draft.orderType} onValueChange={(value) => updateDraft({ orderType: value as WorkOrderType })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="one_off">Una sola vez</SelectItem><SelectItem value="recurring">Recurrente</SelectItem></SelectContent></Select></div>
                    {draft.orderType === "recurring" && <div className="grid grid-cols-2 gap-3"><div className="grid gap-2"><Label>Frecuencia</Label><Select value={draft.recurrenceUnit} onValueChange={(value) => updateDraft({ recurrenceUnit: value as "weekly" | "monthly" })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="weekly">Semanal</SelectItem><SelectItem value="monthly">Mensual</SelectItem></SelectContent></Select></div><div className="grid gap-2"><Label htmlFor="work-order-interval">Cada</Label><Input id="work-order-interval" type="number" min="1" max="52" value={draft.recurrenceInterval} onChange={(event) => updateDraft({ recurrenceInterval: event.target.value })} /></div></div>}
                    <div className="grid grid-cols-2 gap-3"><div className="grid gap-2"><Label htmlFor="work-order-people">Personas previstas</Label><Input id="work-order-people" type="number" min="1" value={draft.estimatedPeople} onChange={(event) => updateDraft({ estimatedPeople: event.target.value })} /></div><div className="grid gap-2"><Label htmlFor="work-order-minutes">Minutos previstos</Label><Input id="work-order-minutes" type="number" min="1" value={draft.estimatedMinutes} onChange={(event) => updateDraft({ estimatedMinutes: event.target.value })} /></div></div>
                    <div className="grid gap-2"><Label htmlFor="work-order-description">Indicaciones</Label><Textarea id="work-order-description" value={draft.description} onChange={(event) => updateDraft({ description: event.target.value })} placeholder="Información operativa para la tarea que se genere." /></div>
                </div>
                <DialogFooter><Button type="button" variant="cancel" onClick={() => onOpenChange(false)}>Cancelar</Button><Button type="button" onClick={() => void save()} disabled={saving}>{saving && <Loader2 className="size-4 animate-spin" />}Crear orden</Button></DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

export default function WorkOrdersPage() {
    const { user } = useUser();
    const canViewMargin = canViewFinance(user) && canViewLaborCosts(user) && !isPlatformSuperadmin(user);
    const canManageMargin = canManageFinance(user) && canViewMargin;
    const [workOrders, setWorkOrders] = React.useState<WorkOrder[]>([]);
    const [locations, setLocations] = React.useState<Location[]>([]);
    const [contracts, setContracts] = React.useState<WorkOrderContractCandidate[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [creating, setCreating] = React.useState(false);
    const [editing, setEditing] = React.useState<WorkOrder | null>(null);
    const [generatingId, setGeneratingId] = React.useState<number | null>(null);
    const [materialsFor, setMaterialsFor] = React.useState<WorkOrder | null>(null);
    const [marginFor, setMarginFor] = React.useState<WorkOrder | null>(null);

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
        <WorkOrderList
            workOrders={workOrders}
            loading={loading}
            locationName={locationName}
            generatingId={generatingId}
            canViewMargin={canViewMargin}
            onEdit={setEditing}
            onMaterials={setMaterialsFor}
            onMargin={setMarginFor}
            onGenerate={(order) => void generate(order)}
        />
        <CreateWorkOrderDialog open={creating} onOpenChange={setCreating} locations={locations} contracts={contracts} onCreated={(workOrder) => setWorkOrders((current) => [workOrder, ...current])} />
        {editing && <EditWorkOrderDialog key={editing.id} workOrder={editing} open onOpenChange={(open) => !open && setEditing(null)} onUpdated={(workOrder) => setWorkOrders((current) => current.map((item) => item.id === workOrder.id ? workOrder : item))} />}
        {materialsFor && <WorkOrderMaterialsDialog key={materialsFor.id} workOrder={materialsFor} open onOpenChange={(open) => !open && setMaterialsFor(null)} />}
        {marginFor && <MarginForecastDialog scopeType="work_order" scopeId={marginFor.id} scopeName={marginFor.title} canManage={canManageMargin} open onOpenChange={(open) => !open && setMarginFor(null)} />}
    </div>;
}
