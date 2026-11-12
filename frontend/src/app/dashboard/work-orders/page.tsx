"use client";

import * as React from "react";
import { ClipboardList, Plus } from "lucide-react";

import { MarginForecastDialog } from "@/components/margin-forecast/MarginForecastDialog";
import { EditWorkOrderDialog } from "@/components/work-orders/EditWorkOrderDialog";
import { WorkOrderList } from "@/components/work-orders/WorkOrderList";
import { CreateWorkOrderDialog } from "@/components/work-orders/CreateWorkOrderDialog";
import { WorkOrderMaterialsDialog } from "@/components/work-orders/WorkOrderMaterialsDialog";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { getErrorMessage } from "@/lib/errors";
import { canManageFinance, canViewFinance, canViewLaborCosts, isPlatformSuperadmin } from "@/domain/access/roles";
import { PAGE_ACTION_BUTTON_PRIMARY } from "@/lib/page-action-button";
import { toast } from "@/lib/toast";
import { useUser } from "@/lib/user-context";
import { useDictionary } from "@/lib/dictionary-context";
import type { User } from "@/types/user";
import { LocationService, type Location } from "@/services/location.service";
import { WorkOrderService } from "@/services/work-order.service";
import type { WorkOrder, WorkOrderContractCandidate } from "@/types/work-order";

export default function WorkOrdersPage() {
    const { user } = useUser();
    if (!user) return null;
    return <WorkOrdersWorkspace key={`${user.id}:${user.company_id}:${user.role?.name}`} user={user} />;
}

function WorkOrdersWorkspace({ user }: { user: User }) {
    const { dict } = useDictionary();
    const canViewMargin = canViewFinance(user) && canViewLaborCosts(user) && !isPlatformSuperadmin(user);
    const canManageMargin = canManageFinance(user) && canViewMargin;
    const [workOrders, setWorkOrders] = React.useState<WorkOrder[]>([]);
    const [locations, setLocations] = React.useState<Location[]>([]);
    const [contracts, setContracts] = React.useState<WorkOrderContractCandidate[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [loaded, setLoaded] = React.useState(false);
    const [loadFailed, setLoadFailed] = React.useState(false);
    const [creating, setCreating] = React.useState(false);
    const [editing, setEditing] = React.useState<WorkOrder | null>(null);
    const [generatingId, setGeneratingId] = React.useState<number | null>(null);
    const [materialsFor, setMaterialsFor] = React.useState<WorkOrder | null>(null);
    const [marginFor, setMarginFor] = React.useState<WorkOrder | null>(null);

    const reload = React.useCallback(async () => {
        setLoading(true);
        setLoadFailed(false);
        try {
            const [orders, nextLocations] = await Promise.all([
                WorkOrderService.getWorkOrders(),
                LocationService.getLocations(),
            ]);
            setWorkOrders(orders);
            setLocations(nextLocations);
            setLoaded(true);
            setContracts(nextLocations.some(location => location.can_manage_tasks)
                ? await WorkOrderService.getContractCandidates() : []);
        } catch {
            setLoadFailed(true);
        } finally {
            setLoading(false);
        }
    }, []);

    React.useEffect(() => {
        const timer = window.setTimeout(() => void reload(), 0);
        return () => window.clearTimeout(timer);
    }, [reload]);

    const manageableLocationIds = React.useMemo(() => new Set(locations.flatMap(location => location.can_manage_tasks ? [location.id] : [])), [locations]);
    const canManageOrder = (order: WorkOrder) => manageableLocationIds.has(order.location_id);
    const locationName = (id: number) => locations.find((location) => location.id === id)?.name ?? `Ubicación #${id}`;
    const generate = async (workOrder: WorkOrder) => {
        if (!canManageOrder(workOrder)) return;
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
        <PageHeader icon={ClipboardList} title="Órdenes de trabajo" subtitle="Planifica una intervención o recurrencia. Las tareas se crean solo cuando generas una ejecución." className="mb-6" actions={!loading && manageableLocationIds.size > 0 ? <Button className={PAGE_ACTION_BUTTON_PRIMARY} onClick={() => setCreating(true)}><Plus className="size-4" />Nueva orden</Button> : undefined} />
        {loadFailed && <div role="alert" className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[var(--border-soft)] bg-[var(--bg-card)] p-4"><p className="text-sm text-[var(--text-muted)]">{dict.workOrderValidation.read_error}</p><Button variant="outline" onClick={() => void reload()} disabled={loading}>{dict.workOrderValidation.retry}</Button></div>}
        {(!loadFailed || loaded) && <WorkOrderList
            workOrders={workOrders}
            loading={loading}
            locationName={locationName}
            generatingId={generatingId}
            canViewMargin={canViewMargin}
            canManageOrder={canManageOrder}
            onEdit={setEditing}
            onMaterials={setMaterialsFor}
            onMargin={setMarginFor}
            onGenerate={(order) => void generate(order)}
        />}
        <CreateWorkOrderDialog open={creating} onOpenChange={setCreating} locations={locations} contracts={contracts} onCreated={(workOrder) => setWorkOrders((current) => [workOrder, ...current])} />
        {editing && <EditWorkOrderDialog key={editing.id} workOrder={editing} readOnly={!canManageOrder(editing)} open onOpenChange={(open) => !open && setEditing(null)} onUpdated={(workOrder) => setWorkOrders((current) => current.map((item) => item.id === workOrder.id ? workOrder : item))} />}
        {materialsFor && <WorkOrderMaterialsDialog key={materialsFor.id} workOrder={materialsFor} open onOpenChange={(open) => !open && setMaterialsFor(null)} />}
        {marginFor && <MarginForecastDialog scopeType="work_order" scopeId={marginFor.id} scopeName={marginFor.title} canManage={canManageMargin} open onOpenChange={(open) => !open && setMarginFor(null)} />}
    </div>;
}
