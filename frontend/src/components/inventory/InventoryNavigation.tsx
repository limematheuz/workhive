"use client";

import { useRef } from "react";
import { Boxes, CircleDollarSign, Library } from "lucide-react";
import { PremiumTabs, type TabOption } from "@/components/ui/premium-tabs";
import { useDictionary } from "@/lib/dictionary-context";
import { groupForInventoryView, inventoryGroups, inventoryViewsForGroup, type InventoryGroup, type InventoryView } from "@/lib/inventory-navigation";

const groupIcons = { operations: Boxes, catalog: Library, purchases: CircleDollarSign };

export function InventoryNavigation({ tabs, activeTab, onChange }: {
    tabs: TabOption<InventoryView>[];
    activeTab: InventoryView;
    onChange: (view: InventoryView) => void;
}) {
    const { dict } = useDictionary();
    const copy = dict.inventoryNavigation;
    const activeGroup = groupForInventoryView(activeTab);
    const lastView = useRef<Partial<Record<InventoryGroup, InventoryView>>>({});
    const groupTabs = inventoryGroups.flatMap(group => inventoryViewsForGroup(tabs, group.id).length > 0
        ? [{ id: group.id, label: copy[group.id], icon: groupIcons[group.id] }] : []);
    const selectView = (view: InventoryView) => {
        lastView.current[groupForInventoryView(view)] = view;
        onChange(view);
    };
    const selectGroup = (group: InventoryGroup) => {
        const views = inventoryViewsForGroup(tabs, group);
        const next = views.find(view => view.id === lastView.current[group]) ?? views[0];
        if (next) selectView(next.id);
    };

    return <section aria-label={copy.navigation} className="space-y-3">
        <PremiumTabs tabs={groupTabs} activeTab={activeGroup} onChange={selectGroup} mobileLabel={copy.area} className="mb-0" />
        {activeGroup !== "purchases" && <div className="rounded-2xl border border-[var(--border-soft)] bg-[var(--bg-primary)]/20 p-2 sm:p-3">
            <p className="mb-2 px-1 text-xs font-semibold text-[var(--text-muted)]">{copy[activeGroup]}</p>
            <PremiumTabs tabs={inventoryViewsForGroup(tabs, activeGroup)} activeTab={activeTab} onChange={selectView} mobileLabel={`${copy.view}: ${copy[activeGroup]}`} className="mb-0" />
        </div>}
    </section>;
}
