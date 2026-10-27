"use client";

import { CalendarPlus, ChartNoAxesCombined, ClipboardList, MapPin, PackageMinus, Pencil, Repeat2 } from "lucide-react";

import { ActionPopover, type PopoverOption } from "@/components/ui/action-popover";
import { Badge } from "@/components/ui/badge";
import { DataListTable } from "@/components/ui/data-list-table";
import { formatDate } from "@/lib/format";
import type { WorkOrder } from "@/types/work-order";
import { workOrderStatusCopy } from "./work-order-form";

type WorkOrderListProps = {
    workOrders: WorkOrder[];
    loading: boolean;
    locationName: (id: number) => string;
    generatingId: number | null;
    canViewMargin: boolean;
    onEdit: (order: WorkOrder) => void;
    onMaterials: (order: WorkOrder) => void;
    onMargin: (order: WorkOrder) => void;
    onGenerate: (order: WorkOrder) => void;
};

function WorkOrderStatus({ status }: { status: WorkOrder["status"] }) {
    const tone = status === "active" || status === "completed"
        ? "border-accent/25 bg-accent/10 text-accent"
        : status === "paused"
            ? "border-[var(--alert-warning-border)] bg-[var(--alert-warning-bg)] text-[var(--alert-warning-text)]"
            : status === "cancelled"
                ? "border-[var(--btn-cancel-border)] bg-[var(--btn-cancel-bg)] text-[var(--btn-cancel-text)]"
                : "border-[var(--border-soft)] bg-[var(--bg-tertiary)] text-[var(--text-muted)]";
    return <Badge variant="outline" className={tone}>{workOrderStatusCopy[status]}</Badge>;
}

function WorkOrderType({ order }: { order: WorkOrder }) {
    return <Badge variant="outline" className="border-[var(--border-soft)] bg-[var(--bg-secondary)] text-[var(--text-muted)]">
        {order.order_type === "recurring" && <Repeat2 aria-hidden="true" />}
        {order.order_type === "recurring" ? "Recurrente" : "Puntual"}
    </Badge>;
}

function WorkOrderSummary({ order }: { order: WorkOrder }) {
    return <div className="min-w-0">
        <p title={order.title} className="truncate text-sm font-semibold text-[var(--text-main)]">{order.title}</p>
        <div className="mt-1.5 flex flex-wrap items-center gap-2">
            <WorkOrderType order={order} />
            <span className="text-xs text-[var(--text-muted)]">{order.service_contract_id ? "Contrato vinculado" : "Orden independiente"}</span>
        </div>
    </div>;
}

export function WorkOrderList({ workOrders, loading, locationName, generatingId, canViewMargin, onEdit, onMaterials, onMargin, onGenerate }: WorkOrderListProps) {
    const actions = (order: WorkOrder) => {
        const options: PopoverOption[] = [
            { label: "Editar", icon: Pencil, variant: "edit", onClick: () => onEdit(order) },
            { label: "Material", icon: PackageMinus, onClick: () => onMaterials(order) },
        ];
        if (canViewMargin) options.push({ label: "Margen", icon: ChartNoAxesCombined, onClick: () => onMargin(order) });
        if (order.status === "active" && order.next_occurrence_at) options.push({
            label: generatingId === order.id ? "Generando tarea…" : "Generar tarea",
            icon: CalendarPlus, disabled: generatingId !== null, onClick: () => onGenerate(order),
        });
        return <div className="flex shrink-0 justify-end" onClick={event => event.stopPropagation()}>
            <ActionPopover triggerLabel={`Acciones de ${order.title}`} options={options} />
        </div>;
    };

    return <DataListTable
        items={workOrders} getRowKey={order => order.id} loading={loading} desktopFrom="lg"
        onRowClick={onEdit} rowAriaLabel={order => `Editar orden ${order.title}`}
        header={{ title: "Planificación operativa", subtitle: "Una orden organiza el trabajo; una tarea registra la ejecución real.", countLabel: `${workOrders.length} órdenes` }}
        columns={[
            { key: "title", label: "Orden", className: "w-[32%]" },
            { key: "location", label: "Ubicación", className: "w-[23%]" },
            { key: "next", label: "Próxima ejecución", className: "whitespace-normal leading-relaxed" },
            { key: "status", label: "Estado", className: "w-[8rem]" },
            { key: "actions", label: <span className="sr-only">Acciones</span>, className: "w-[3.5rem] text-right" },
        ]}
        renderDesktopRow={order => [
            <div key="title"><WorkOrderSummary order={order} /></div>,
            <div key="location" className="flex min-w-0 items-center gap-2 text-sm text-[var(--text-main)]"><MapPin className="size-4 shrink-0 text-[var(--text-muted)]" /><span title={locationName(order.location_id)} className="truncate">{locationName(order.location_id)}</span></div>,
            <p key="next" className="text-sm text-[var(--text-main)]">{order.next_occurrence_at ? formatDate(order.next_occurrence_at) : "—"}</p>,
            <div key="status"><WorkOrderStatus status={order.status} /></div>,
            <div key="actions">{actions(order)}</div>,
        ]}
        renderCompactRow={order => <div className="min-w-0">
            <div className="flex items-start justify-between gap-2"><div className="min-w-0 flex-1"><WorkOrderSummary order={order} /></div>{actions(order)}</div>
            <p className="mt-2 truncate text-xs text-[var(--text-muted)]">{locationName(order.location_id)}</p>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-[var(--table-divider)] pt-3">
                <span className="text-xs text-[var(--text-muted)]">{order.next_occurrence_at ? formatDate(order.next_occurrence_at) : "Sin ejecución pendiente"}</span>
                <WorkOrderStatus status={order.status} />
            </div>
        </div>}
        empty={<div><ClipboardList className="mx-auto mb-3 size-10 text-[var(--text-muted)] opacity-50" /><p className="text-sm font-medium text-[var(--text-muted)]">Crea una orden para planificar el próximo trabajo.</p></div>}
    />;
}
