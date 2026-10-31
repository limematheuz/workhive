import type { InventoryMovementType } from "../types/inventory";

export type InventoryMovementDraft = {
    materialId: string;
    warehouseId: string;
    lotId: string;
    movementType: InventoryMovementType;
    quantity: string;
    reference: string;
};

type MovementCatalog = {
    materials: readonly { id: number }[];
    warehouses: readonly { id: number }[];
    lots: readonly { id: number; material_id: number; warehouse_id: number }[];
};

/** Reconcile only after a successful catalogue refresh, preserving unfinished input. */
export function reconcileInventoryMovementDraft(draft: InventoryMovementDraft, catalog: MovementCatalog): InventoryMovementDraft {
    const materialId = catalog.materials.some(item => String(item.id) === draft.materialId) ? draft.materialId : "";
    const warehouseId = catalog.warehouses.some(item => String(item.id) === draft.warehouseId) ? draft.warehouseId : "";
    const lotId = materialId && warehouseId && catalog.lots.some(lot => String(lot.id) === draft.lotId
        && String(lot.material_id) === materialId && String(lot.warehouse_id) === warehouseId) ? draft.lotId : "none";
    return materialId === draft.materialId && warehouseId === draft.warehouseId && lotId === draft.lotId
        ? draft : { ...draft, materialId, warehouseId, lotId };
}
