import React from "react";
import { LucideIcon } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

export interface TabOption<T extends string> {
    id: T;
    label: string | React.ReactNode;
    /** Short label shown on small screens when a full label would crowd the tab bar. */
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
    /** `fit` keeps every tab visible without horizontal scroll (mobile-safe). Default for ≤4 tabs. */
    layout?: "scroll" | "fit";
    /** Accessible label for the mobile section picker. */
    mobileLabel?: string;
}

export function PremiumTabs<T extends string>({
    tabs,
    activeTab,
    onChange,
    className = "",
    layout = "fit",
    mobileLabel = "Seleccionar sección",
}: PremiumTabsProps<T>) {
    const fit = layout === "fit";

    return (
        <Tabs value={activeTab} onValueChange={(id) => onChange(id as T)}>
        <div className="sm:hidden">
            <Select value={activeTab} onValueChange={(id) => onChange(id as T)}>
                <SelectTrigger aria-label={mobileLabel} className="h-11 rounded-2xl bg-[var(--bg-primary)]/45 font-semibold text-[var(--text-main)]">
                    <SelectValue />
                </SelectTrigger>
                <SelectContent>
                    {tabs.map((tab) => {
                        const Icon = tab.icon;
                        return (
                            <SelectItem key={tab.id} value={tab.id}>
                                <span className="flex items-center gap-2">
                                    {Icon && <Icon className="size-4 text-accent" aria-hidden="true" />}
                                    <span>{tab.label}</span>
                                    {tab.badge !== undefined && tab.badge > 0 && <span className="text-xs font-semibold text-accent">({tab.badge})</span>}
                                </span>
                            </SelectItem>
                        );
                    })}
                </SelectContent>
            </Select>
        </div>
        <TabsList
            className={`hidden h-auto w-full gap-1 rounded-2xl border border-[var(--border-soft)] bg-[var(--bg-primary)]/40 p-1 sm:flex ${
                fit
                    ? "overflow-hidden"
                    : "snap-x overflow-x-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
            } ${className}`}
        >
            {tabs.map((tab) => {
                const isActive = activeTab === tab.id;
                const Icon = tab.icon;
                return (
                    <TabsTrigger
                        key={tab.id}
                        value={tab.id}
                        title={typeof tab.label === "string" ? tab.label : undefined}
                        className={`flex flex-1 items-center justify-center rounded-xl border-none py-2 text-xs font-bold uppercase tracking-wider ui-motion cursor-pointer select-none ${
                            fit
                                ? "min-w-0 gap-1.5 px-2 sm:gap-2 sm:px-3"
                                : "shrink-0 snap-align-start gap-2 px-3"
                        } ${
                            isActive
                                ? "bg-accent font-black text-white shadow-md"
                                : "bg-transparent text-[var(--text-muted)] hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-main)]"
                        }`}
                    >
                        {Icon && (
                            <Icon
                                className={`h-3.5 w-3.5 shrink-0 transition-colors ${
                                    isActive ? "text-white" : "text-[var(--text-main)]"
                                }`}
                            />
                        )}
                        <span className={fit ? "min-w-0 truncate" : undefined}>
                            {tab.compactLabel ? <span className="sm:hidden">{tab.compactLabel}</span> : null}
                            <span className={tab.compactLabel ? "hidden sm:inline" : undefined}>{tab.label}</span>
                        </span>
                        {tab.badge !== undefined && tab.badge > 0 && (
                            <span
                                className={`relative inline-flex min-w-5 items-center justify-center rounded-full px-1.5 py-0.5 text-[10px] font-black leading-none text-white shadow-sm ${
                                    tab.badgeTone === "info"
                                        ? "bg-accent shadow-accent/30"
                                        : "bg-red-500 shadow-red-500/30"
                                }`}
                            >
                                <span className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-60 ${
                                    tab.badgeTone === "info" ? "bg-accent/70" : "bg-red-400"
                                }`} />
                                <span className="relative">{tab.badge > 99 ? "99+" : tab.badge}</span>
                            </span>
                        )}
                        {tab.attention && !tab.badge && (
                            <span className="relative flex h-2.5 w-2.5">
                                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-60" />
                                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-red-500" />
                            </span>
                        )}
                    </TabsTrigger>
                );
            })}
        </TabsList>
        </Tabs>
    );
}
