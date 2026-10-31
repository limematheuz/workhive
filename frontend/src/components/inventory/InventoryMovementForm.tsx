"use client";

import { ArrowDownToLine, ArrowUpFromLine } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { InventoryLot, InventoryMaterial, InventoryMovementType, InventoryWarehouse } from "@/types/inventory";

import type { InventoryMovementDraft } from "@/lib/inventory-movement-draft";

export function InventoryMovementForm({ materials, warehouses, lots, draft, labels, saving, onChange, onSubmit }: {
    materials: InventoryMaterial[];
    warehouses: InventoryWarehouse[];
    lots: InventoryLot[];
    draft: InventoryMovementDraft;
    labels: Record<InventoryMovementType, string>;
    saving: boolean;
    onChange: (patch: Partial<InventoryMovementDraft>) => void;
    onSubmit: () => void;
}) {
    const availableLots = lots.filter(lot => lot.material_id === Number(draft.materialId) && lot.warehouse_id === Number(draft.warehouseId));
    return <div className="grid gap-2 sm:grid-cols-2 2xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,0.8fr)_minmax(0,0.8fr)_7rem_minmax(0,1fr)_auto]">
        <Select disabled={saving} value={draft.materialId} onValueChange={materialId => onChange({ materialId, lotId: "none" })}><SelectTrigger aria-label="Material"><SelectValue placeholder="Material" /></SelectTrigger><SelectContent>{materials.map(material => <SelectItem key={material.id} value={String(material.id)}>{material.name}</SelectItem>)}</SelectContent></Select>
        <Select disabled={saving} value={draft.warehouseId} onValueChange={warehouseId => onChange({ warehouseId, lotId: "none" })}><SelectTrigger aria-label="Almacén"><SelectValue placeholder="Almacén" /></SelectTrigger><SelectContent>{warehouses.map(warehouse => <SelectItem key={warehouse.id} value={String(warehouse.id)}>{warehouse.name}</SelectItem>)}</SelectContent></Select>
        <Select disabled={saving || !draft.materialId || !draft.warehouseId} value={draft.lotId} onValueChange={lotId => onChange({ lotId })}><SelectTrigger aria-label="Lote"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">Sin lote</SelectItem>{availableLots.map(lot => <SelectItem key={lot.id} value={String(lot.id)}>{lot.code}</SelectItem>)}</SelectContent></Select>
        <Select disabled={saving} value={draft.movementType} onValueChange={movementType => onChange({ movementType: movementType as InventoryMovementType })}><SelectTrigger aria-label="Tipo de movimiento"><SelectValue /></SelectTrigger><SelectContent>{Object.entries(labels).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select>
        <Input disabled={saving} value={draft.quantity} onChange={event => onChange({ quantity: event.target.value })} type="number" min="0.001" step="0.001" aria-label="Cantidad" />
        <Input disabled={saving} value={draft.reference} onChange={event => onChange({ reference: event.target.value })} placeholder="Referencia opcional" aria-label="Referencia" />
        <Button type="button" className="sm:col-span-2 2xl:col-span-1" disabled={!draft.materialId || !draft.warehouseId || !draft.quantity || Number(draft.quantity) <= 0 || saving} onClick={onSubmit}>
            {draft.movementType === "issue" || draft.movementType === "adjustment_out" ? <ArrowUpFromLine className="size-4" /> : <ArrowDownToLine className="size-4" />}Registrar movimiento
        </Button>
    </div>;
}
