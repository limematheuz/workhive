"use client";

import * as React from "react";
import { ClipboardList, Plus } from "lucide-react";

import { MarginForecastDialog } from "@/components/margin-forecast/MarginForecastDialog";
import { EditWorkOrderDialog } from "@/components/work-orders/EditWorkOrderDialog";
import { WorkOrderList } from "@/components/work-orders/WorkOrderList";
import {ServicePlanner} from "@/components/operations/ServicePlanner";
import { WorkOrderMaterialsDialog } from "@/components/work-orders/WorkOrderMaterialsDialog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PageHeader } from "@/components/ui/page-header";
import {WorkOrderScopeDialog} from "@/components/work-orders/WorkOrderScopeDialog";
import { getErrorMessage } from "@/lib/errors";
import { canManageFinance, canViewFinance, canViewLaborCosts, isPlatformSuperadmin } from "@/domain/access/roles";
import { PAGE_ACTION_BUTTON_PRIMARY } from "@/lib/page-action-button";
import { toast } from "@/lib/toast";
import { useUser } from "@/lib/user-context";
import { LocationService, type Location } from "@/services/location.service";
import { WorkOrderService } from "@/services/work-order.service";
import type { WorkOrder, WorkOrderContractCandidate } from "@/types/work-order";

function CreateWorkOrderDialog({open,onOpenChange,locations,contracts,onCreated}:{open:boolean;onOpenChange:(value:boolean)=>void;locations:Location[];contracts:WorkOrderContractCandidate[];onCreated:(order:WorkOrder)=>void}){
    return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-6xl" confirmDiscard><DialogHeader><DialogTitle>Planificar trabajo</DialogTitle><DialogDescription>Selecciona la ubicación, los espacios que se van a limpiar y las personas de cada espacio.</DialogDescription></DialogHeader><ServicePlanner locations={locations} contracts={contracts} saved={order=>{onCreated(order);onOpenChange(false);}}/></DialogContent></Dialog>;
}

export default function WorkOrdersPage() {
    const { user } = useUser();
    const canViewMargin = canViewFinance(user) && canViewLaborCosts(user) && !isPlatformSuperadmin(user);
    const canManageMargin = canManageFinance(user) && canViewMargin;
    const [orderFilter, setOrderFilter] = React.useState("all");
    const [workOrders, setWorkOrders] = React.useState<WorkOrder[]>([]);
    const [locations, setLocations] = React.useState<Location[]>([]);
    const [contracts, setContracts] = React.useState<WorkOrderContractCandidate[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [creating, setCreating] = React.useState(false);
    const [editing, setEditing] = React.useState<WorkOrder | null>(null);
    const [generatingId, setGeneratingId] = React.useState<number | null>(null);
    const [scopeFor,setScopeFor]=React.useState<WorkOrder|null>(null);
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
        <PageHeader icon={ClipboardList} title="Trabajos programados" subtitle="Servicios puntuales y recurrentes, con espacios y equipos asignados." className="mb-6" actions={<Button className={PAGE_ACTION_BUTTON_PRIMARY} onClick={() => setCreating(true)}><Plus className="size-4" />Planificar trabajo</Button>} />
        <div className="mb-3 flex flex-wrap gap-2" aria-label="Tipo de trabajo">
            {[["all","Todos"],["one_off","Puntuales"],["recurring","Servicios recurrentes"]].map(([value,label]) =>
                <Button key={value} size="sm" aria-pressed={orderFilter === value} variant={orderFilter === value ? "default" : "outline"} onClick={() => setOrderFilter(value)}>{label}</Button>)}
        </div>
        <WorkOrderList
            workOrders={workOrders.filter(order => orderFilter === "all" || order.order_type === orderFilter)}
            loading={loading}
            locationName={locationName}
            generatingId={generatingId}
            canViewMargin={canViewMargin}
            onEdit={setEditing}
            onScope={setScopeFor}
            onMaterials={setMaterialsFor}
            onMargin={setMarginFor}
            onGenerate={(order) => void generate(order)}
        />
        <CreateWorkOrderDialog open={creating} onOpenChange={setCreating} locations={locations} contracts={contracts} onCreated={(workOrder) => setWorkOrders((current) => [workOrder, ...current])} />
        {editing && <EditWorkOrderDialog key={editing.id} workOrder={editing} open onOpenChange={(open) => !open && setEditing(null)} onUpdated={(workOrder) => setWorkOrders((current) => current.map((item) => item.id === workOrder.id ? workOrder : item))} />}
        {scopeFor&&<WorkOrderScopeDialog order={scopeFor} open onOpenChange={open=>!open&&setScopeFor(null)} updated={()=>void reload()}/>}
        {materialsFor && <WorkOrderMaterialsDialog key={materialsFor.id} workOrder={materialsFor} open onOpenChange={(open) => !open && setMaterialsFor(null)} />}
        {marginFor && <MarginForecastDialog scopeType="work_order" scopeId={marginFor.id} scopeName={marginFor.title} canManage={canManageMargin} open onOpenChange={(open) => !open && setMarginFor(null)} />}
    </div>;
}
