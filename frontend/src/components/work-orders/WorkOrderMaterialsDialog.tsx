"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, PackageMinus, RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { DataListTable, type DataListColumn } from "@/components/ui/data-list-table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { WorkOrderMaterialCorrectionDialog } from "@/components/work-orders/WorkOrderMaterialCorrectionDialog";
import { getErrorMessage } from "@/lib/errors";
import { toast } from "@/lib/toast";
import { InventoryService } from "@/services/inventory.service";
import { WorkOrderService } from "@/services/work-order.service";
import type { InventoryLot, InventoryMaterial, InventoryMovement, InventoryWarehouse } from "@/types/inventory";
import type { WorkOrder } from "@/types/work-order";


type WorkOrderMaterialsDialogProps = {
    workOrder: WorkOrder;
    open: boolean;
    onOpenChange: (open: boolean) => void;
};

const columns: DataListColumn[] = [
    { key: "material", label: "Material", className: "w-[28%]" },
    { key: "warehouse", label: "Almacén", className: "w-[22%]" },
    { key: "lot", label: "Lote", className: "w-[17%]" },
    { key: "quantity", label: "Cantidad", className: "w-[15%] text-right" },
    { key: "actions", label: "", className: "w-[18%] text-right" },
];

const quantityFormatter = new Intl.NumberFormat("es-ES", { maximumFractionDigits: 3 });

function quantity(value: string) {
    return quantityFormatter.format(Number(value));
}

export function WorkOrderMaterialsDialog({ workOrder, open, onOpenChange }: WorkOrderMaterialsDialogProps) {
    const canConsume = workOrder.status === "active" || workOrder.status === "paused";
    const [materials, setMaterials] = useState<InventoryMaterial[]>([]);
    const [warehouses, setWarehouses] = useState<InventoryWarehouse[]>([]);
    const [lots, setLots] = useState<InventoryLot[]>([]);
    const [movements, setMovements] = useState<InventoryMovement[]>([]);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [materialId, setMaterialId] = useState("");
    const [warehouseId, setWarehouseId] = useState("");
    const [lotId, setLotId] = useState("none");
    const [consumedQuantity, setConsumedQuantity] = useState("");
    const [notes, setNotes] = useState("");
    const [reversingId, setReversingId] = useState<number | null>(null);
    const [movementToReverse, setMovementToReverse] = useState<InventoryMovement | null>(null);

    const reload = useCallback(async () => {
        setLoading(true);
        try {
            const [nextMaterials, nextWarehouses, nextLots, nextMovements] = await Promise.all([
                InventoryService.getMaterials(),
                InventoryService.getWarehouses(),
                InventoryService.getLots(),
                WorkOrderService.getMaterialConsumptions(workOrder.id),
            ]);
            setMaterials(nextMaterials);
            setWarehouses(nextWarehouses);
            setLots(nextLots);
            setMovements(nextMovements);
        } catch (error) {
            toast.error(getErrorMessage(error, "No se pudo cargar el material de la orden."));
        } finally {
            setLoading(false);
        }
    }, [workOrder.id]);

    useEffect(() => {
        if (!open) return;
        const timer = window.setTimeout(() => void reload(), 0);
        return () => window.clearTimeout(timer);
    }, [open, reload]);

    const availableLots = useMemo(
        () => lots.filter((lot) => lot.material_id === Number(materialId) && lot.warehouse_id === Number(warehouseId)),
        [lots, materialId, warehouseId],
    );
    const materialsById = useMemo(() => new Map(materials.map((material) => [material.id, material])), [materials]);
    const warehousesById = useMemo(() => new Map(warehouses.map((warehouse) => [warehouse.id, warehouse])), [warehouses]);
    const lotsById = useMemo(() => new Map(lots.map((lot) => [lot.id, lot])), [lots]);
    const correctedMovementIds = useMemo(
        () => new Set(movements.flatMap((movement) => movement.reversal_of_movement_id ? [movement.reversal_of_movement_id] : [])),
        [movements],
    );

    const consume = async () => {
        if (!materialId || !warehouseId || !consumedQuantity || Number(consumedQuantity) <= 0) return;
        setSaving(true);
        try {
            await WorkOrderService.consumeMaterial(workOrder.id, {
                material_id: Number(materialId),
                warehouse_id: Number(warehouseId),
                lot_id: lotId === "none" ? null : Number(lotId),
                quantity: consumedQuantity,
                notes: notes.trim() || null,
            });
            setLotId("none");
            setConsumedQuantity("");
            setNotes("");
            toast.success("Consumo de material registrado.");
            await reload();
        } catch (error) {
            toast.error(getErrorMessage(error, "No se pudo registrar el consumo."));
        } finally {
            setSaving(false);
        }
    };

    const reverse = async (movement: InventoryMovement, reason: string) => {
        setReversingId(movement.id);
        try {
            await WorkOrderService.reverseMaterialConsumption(workOrder.id, movement.id, reason);
            toast.success("Consumo corregido mediante una entrada de ajuste.");
            await reload();
            return true;
        } catch (error) {
            toast.error(getErrorMessage(error, "No se pudo corregir el consumo."));
            return false;
        } finally {
            setReversingId(null);
        }
    };

    return <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent compact className="max-w-4xl" confirmDiscard>
            <DialogHeader><DialogTitle>Material consumido</DialogTitle><DialogDescription>{workOrder.title}. Cada registro es un movimiento inmutable de salida; las correcciones añaden una entrada de ajuste.</DialogDescription></DialogHeader>
            <div className="grid gap-5 py-2">
                <div className="grid gap-3 rounded-2xl border border-[var(--border-soft)] bg-[var(--bg-tertiary)]/55 p-4">
                    <div><p className="text-sm font-semibold text-[var(--text-main)]">Registrar consumo</p>{!canConsume && <p className="mt-1 text-xs text-[var(--text-muted)]">La orden está cerrada; conserva su historial pero no admite nuevas salidas.</p>}</div>
                    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-[minmax(11rem,1fr)_minmax(11rem,1fr)_minmax(10rem,1fr)_7rem]">
                        <Select value={materialId} onValueChange={(value) => { setMaterialId(value); setLotId("none"); }} disabled={!canConsume}><SelectTrigger aria-label="Material consumido"><SelectValue placeholder="Material" /></SelectTrigger><SelectContent>{materials.map((material) => <SelectItem key={material.id} value={String(material.id)}>{material.name}</SelectItem>)}</SelectContent></Select>
                        <Select value={warehouseId} onValueChange={(value) => { setWarehouseId(value); setLotId("none"); }} disabled={!canConsume}><SelectTrigger aria-label="Almacén de salida"><SelectValue placeholder="Almacén" /></SelectTrigger><SelectContent>{warehouses.map((warehouse) => <SelectItem key={warehouse.id} value={String(warehouse.id)}>{warehouse.name}</SelectItem>)}</SelectContent></Select>
                        <Select value={lotId} onValueChange={setLotId} disabled={!canConsume || !materialId || !warehouseId}><SelectTrigger aria-label="Lote consumido"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">Sin lote</SelectItem>{availableLots.map((lot) => <SelectItem key={lot.id} value={String(lot.id)}>{lot.code} · {quantity(lot.available_quantity)}</SelectItem>)}</SelectContent></Select>
                        <Input type="number" min="0.001" step="0.001" disabled={!canConsume} value={consumedQuantity} onChange={(event) => setConsumedQuantity(event.target.value)} placeholder="Cantidad" aria-label="Cantidad consumida" />
                    </div>
                    <div className="grid gap-2 sm:grid-cols-[1fr_auto]"><div className="grid gap-1"><Label htmlFor="work-order-material-notes">Nota interna</Label><Textarea id="work-order-material-notes" rows={2} disabled={!canConsume} value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Opcional" /></div><Button className="self-end" type="button" disabled={!canConsume || !materialId || !warehouseId || !consumedQuantity || Number(consumedQuantity) <= 0 || saving} onClick={() => void consume()}>{saving && <Loader2 className="size-4 animate-spin" />}<PackageMinus className="size-4" />Registrar</Button></div>
                </div>
                <DataListTable
                    items={movements}
                    getRowKey={(movement) => movement.id}
                    columns={columns}
                    loading={loading}
                    header={{ title: "Trazabilidad", subtitle: "Consumos y correcciones de esta orden.", countLabel: `${movements.length} movimientos` }}
                    empty={<p className="text-sm text-[var(--text-muted)]">Todavía no hay material registrado para esta orden.</p>}
                    renderDesktopRow={(movement) => [
                        <div key="material" className="min-w-0"><p className="whitespace-normal break-words font-semibold text-[var(--text-main)]">{materialsById.get(movement.material_id)?.name ?? movement.material_name ?? `Material #${movement.material_id}`}</p><p className="mt-1 text-xs text-[var(--text-muted)]">{movement.movement_type === "issue" ? "Consumo" : "Corrección"}</p></div>,
                        <span key="warehouse" className="block whitespace-normal break-words text-sm text-[var(--text-main)]">{warehousesById.get(movement.warehouse_id)?.name ?? movement.warehouse_name ?? `Almacén #${movement.warehouse_id}`}</span>,
                        <span key="lot" className="block whitespace-normal break-words text-sm text-[var(--text-muted)]">{movement.lot_id ? lotsById.get(movement.lot_id)?.code ?? movement.lot_code ?? `Lote #${movement.lot_id}` : "—"}</span>,
                        <span key="quantity" className="block text-right text-sm font-semibold text-[var(--text-main)]">{movement.movement_type === "issue" ? "−" : "+"}{quantity(movement.quantity)}</span>,
                        <div key="actions" className="flex justify-end">{movement.movement_type === "issue" && !correctedMovementIds.has(movement.id) && <Button type="button" size="sm" variant="outline" disabled={reversingId === movement.id} onClick={() => setMovementToReverse(movement)}>{reversingId === movement.id ? <Loader2 className="size-4 animate-spin" /> : <RotateCcw className="size-4" />}Corregir</Button>}</div>,
                    ]}
                    renderCompactRow={(movement) => <div className="flex min-w-0 items-center justify-between gap-3"><div className="min-w-0"><p className="whitespace-normal break-words font-semibold text-[var(--text-main)]">{materialsById.get(movement.material_id)?.name ?? movement.material_name ?? `Material #${movement.material_id}`}</p><p className="mt-1 whitespace-normal break-words text-xs text-[var(--text-muted)]">{movement.movement_type === "issue" ? "Consumo" : "Corrección"} · {movement.lot_id ? lotsById.get(movement.lot_id)?.code ?? movement.lot_code ?? `Lote #${movement.lot_id}` : "Sin lote"}</p></div><div className="flex shrink-0 items-center gap-2"><span className="text-sm font-semibold text-[var(--text-main)]">{movement.movement_type === "issue" ? "−" : "+"}{quantity(movement.quantity)}</span>{movement.movement_type === "issue" && !correctedMovementIds.has(movement.id) && <Button type="button" size="sm" variant="outline" disabled={reversingId === movement.id} onClick={() => setMovementToReverse(movement)}><RotateCcw className="size-4" />Corregir</Button>}</div></div>}
                />
            </div>
            <DialogFooter><Button type="button" variant="cancel" onClick={() => onOpenChange(false)}>Cerrar</Button></DialogFooter>
            <WorkOrderMaterialCorrectionDialog movement={movementToReverse} isSubmitting={reversingId !== null} onOpenChange={(open) => !open && setMovementToReverse(null)} onConfirm={reverse} />
        </DialogContent>
    </Dialog>;
}
