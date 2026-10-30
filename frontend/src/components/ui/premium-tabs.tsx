"use client";

import type React from "react";
import { Layers3, type LucideIcon } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PremiumTabLabel } from "./premium-tab-label";
import { premiumTabTriggerClass } from "./premium-tab-styles";
import { useAdaptiveTabs } from "@/hooks/useAdaptiveTabs";
import { useDictionary } from "@/lib/dictionary-context";
import { cn } from "@/lib/utils";

export interface TabOption<T extends string> {
    id: T;
    label: string | React.ReactNode;
    compactLabel?: string;
    icon?: LucideIcon;
    badge?: number;
    badgeTone?: "info" | "danger";
    attention?: boolean;
}

interface PremiumTabsProps<T extends string> {
    tabs: TabOption<T>[];
    activeTab: T;
    onChange: (id: T) => void;
    className?: string;
    /** Legacy callers remain compatible; count and available space now decide the layout. */
    layout?: "scroll" | "fit";
    mobileLabel?: string;
}

const tabListClass = "flex h-auto w-full items-center gap-1 rounded-2xl border border-[var(--border-soft)] bg-[var(--bg-primary)]/40 p-1";

/** Navigation inside an existing Tabs root, such as a wizard with TabsContent. */
export function PremiumTabsNavigation<T extends string>({ tabs, activeTab, onChange, className, mobileLabel }: PremiumTabsProps<T>) {
    const { dict } = useDictionary();
    const { containerRef, measurementRef, dropdown, ready } = useAdaptiveTabs(tabs.length);
    const pickerLabel = mobileLabel || dict.tabNavigation.select;

    // Radix also emits native select changes inside forms; view changes are not edits.
    return <div ref={containerRef} data-tab-navigation data-form-guard-ignore data-tabs-ready={ready} className={cn("relative mb-4 w-full min-w-0", className)}>
        <div aria-hidden="true" inert className="pointer-events-none invisible absolute inset-0 overflow-hidden">
            <div ref={measurementRef} className={cn(tabListClass, "w-max")}>
                {tabs.map(tab => <span key={tab.id} className={premiumTabTriggerClass(activeTab === tab.id)}><PremiumTabLabel tab={tab} active={activeTab === tab.id} /></span>)}
            </div>
        </div>
        {dropdown ? <div className="space-y-1.5">
            <p className="flex items-center gap-1.5 px-1 text-xs font-medium text-[var(--text-muted)]">
                <Layers3 className="size-3.5 shrink-0" aria-hidden="true" />
                {dict.tabNavigation.change} · {dict.tabNavigation.options.replace("{count}", String(tabs.length))}
            </p>
            <Select value={activeTab} onValueChange={(id) => onChange(id as T)}>
                <SelectTrigger aria-label={pickerLabel} className="h-11 rounded-2xl bg-[var(--bg-primary)]/45 font-semibold text-[var(--text-main)]"><SelectValue /></SelectTrigger>
                <SelectContent data-form-guard-ignore>
                    {tabs.map(tab => <SelectItem key={tab.id} value={tab.id}><span className="flex min-w-0 items-center gap-2"><PremiumTabLabel tab={tab} compact={false} /></span></SelectItem>)}
                </SelectContent>
            </Select>
        </div> : <TabsList aria-label={pickerLabel} className={tabListClass}>
            {tabs.map(tab => <TabsTrigger key={tab.id} value={tab.id} title={typeof tab.label === "string" ? tab.label : undefined} className={premiumTabTriggerClass(activeTab === tab.id)}>
                <PremiumTabLabel tab={tab} active={activeTab === tab.id} />
            </TabsTrigger>)}
        </TabsList>}
    </div>;
}

export function PremiumTabs<T extends string>(props: PremiumTabsProps<T>) {
    return <Tabs value={props.activeTab} onValueChange={(id) => props.onChange(id as T)}><PremiumTabsNavigation {...props} /></Tabs>;
}
