export type InventoryView = "stock" | "materials" | "suppliers" | "warehouses" | "movements" | "lots" | "purchases";
export type InventoryGroup = "operations" | "catalog" | "purchases";

export const inventoryGroups: readonly { id: InventoryGroup; views: readonly InventoryView[] }[] = [
    { id: "operations", views: ["stock", "movements", "lots"] },
    { id: "catalog", views: ["materials", "warehouses", "suppliers"] },
    { id: "purchases", views: ["purchases"] },
];

export function groupForInventoryView(view: InventoryView): InventoryGroup {
    const group = inventoryGroups.find(group => group.views.includes(view));
    if (!group) throw new Error("Unknown inventory view");
    return group.id;
}

export function inventoryViewsForGroup<T extends { id: InventoryView }>(views: readonly T[], group: InventoryGroup): T[] {
    const definition = inventoryGroups.find(item => item.id === group);
    if (!definition) return [];
    return definition.views.flatMap(id => {
        const view = views.find(item => item.id === id);
        return view ? [view] : [];
    });
}
