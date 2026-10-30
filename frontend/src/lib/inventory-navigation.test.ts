import assert from "node:assert/strict";
import test from "node:test";
import { groupForInventoryView, inventoryGroups, inventoryViewsForGroup, type InventoryView } from "./inventory-navigation.ts";

const views = ["stock", "materials", "suppliers", "warehouses", "movements", "lots", "purchases"].map(id => ({ id: id as InventoryView }));
test("inventory groups preserve all seven views once, in the agreed order", () => {
    assert.deepEqual(inventoryGroups.map(group => group.id), ["operations", "catalog", "purchases"]);
    assert.deepEqual(inventoryViewsForGroup(views, "operations").map(view => view.id), ["stock", "movements", "lots"]);
    assert.deepEqual(inventoryViewsForGroup(views, "catalog").map(view => view.id), ["materials", "warehouses", "suppliers"]);
    const grouped = inventoryGroups.flatMap(group => inventoryViewsForGroup(views, group.id));
    assert.equal(grouped.length, 7);
    assert.equal(new Set(grouped.map(view => view.id)).size, 7);
    for (const view of views) assert.ok(inventoryViewsForGroup(views, groupForInventoryView(view.id)).includes(view));
});
test("inventory groups never restore a view excluded by permissions", () => {
    const allowed = views.filter(view => view.id !== "purchases");
    assert.deepEqual(inventoryViewsForGroup(allowed, "purchases"), []);
    assert.deepEqual(allowed, views.slice(0, -1));
});
