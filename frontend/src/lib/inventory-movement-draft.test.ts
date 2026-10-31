import assert from "node:assert/strict";
import test from "node:test";
import { reconcileInventoryMovementDraft, type InventoryMovementDraft } from "./inventory-movement-draft.ts";

const draft: InventoryMovementDraft = { materialId: "1", warehouseId: "2", lotId: "3", movementType: "issue", quantity: "5.125", reference: "Borrador" };
const catalog = { materials: [{ id: 1 }], warehouses: [{ id: 2 }], lots: [{ id: 3, material_id: 1, warehouse_id: 2 }] };

test("refresh preserves valid selections, quantity and reference without replacing the draft", () => {
    assert.equal(reconcileInventoryMovementDraft(draft, catalog), draft);
});

test("archiving the selected material clears it and its lot while preserving warehouse and input", () => {
    assert.deepEqual(reconcileInventoryMovementDraft(draft, { ...catalog, materials: [] }), { ...draft, materialId: "", lotId: "none" });
});

test("archiving the selected warehouse clears it and its lot while preserving material and input", () => {
    assert.deepEqual(reconcileInventoryMovementDraft(draft, { ...catalog, warehouses: [] }), { ...draft, warehouseId: "", lotId: "none" });
});

test("a missing lot does not discard valid material, warehouse or input", () => {
    assert.deepEqual(reconcileInventoryMovementDraft(draft, { ...catalog, lots: [] }), { ...draft, lotId: "none" });
});

test("a lot belonging to another material or warehouse cannot remain selected", () => {
    for (const lot of [{ id: 3, material_id: 4, warehouse_id: 2 }, { id: 3, material_id: 1, warehouse_id: 5 }]) {
        assert.deepEqual(reconcileInventoryMovementDraft(draft, { ...catalog, lots: [lot] }), { ...draft, lotId: "none" });
    }
});

test("an empty catalogue clears all unavailable selections without discarding unfinished input", () => {
    const result = reconcileInventoryMovementDraft(draft, { materials: [], warehouses: [], lots: [] });
    assert.deepEqual(result, { ...draft, materialId: "", warehouseId: "", lotId: "none" });
    assert.deepEqual(draft, { materialId: "1", warehouseId: "2", lotId: "3", movementType: "issue", quantity: "5.125", reference: "Borrador" });
});
