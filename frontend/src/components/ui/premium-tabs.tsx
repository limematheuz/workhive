import React from "react";
import { LucideIcon } from "lucide-react";

export interface TabOption<T extends string> {
    id: T;
    label: string | React.ReactNode;
    icon?: LucideIcon;
    badge?: number;
    attention?: boolean;
}

interface PremiumTabsProps<T extends string> {
    tabs: TabOption<T>[];
    activeTab: T;
    onChange: (id: T) => void;
    className?: string;
    /** `fit` keeps every tab visible without horizontal scroll (mobile-safe). */
    layout?: "scroll" | "fit";
}

export function PremiumTabs<T extends string>({
    tabs,
    activeTab,
    onChange,
    className = "",
    layout = "scroll",
}: PremiumTabsProps<T>) {
    const fit = layout === "fit";

    return (
        <div
            className={`flex w-full gap-1 rounded-2xl border border-[var(--border-soft)] bg-[var(--bg-primary)]/40 p-1 ${
                fit
                    ? "overflow-hidden"
                    : "snap-x overflow-x-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
            } ${className}`}
        >
            {tabs.map((tab) => {
                const isActive = activeTab === tab.id;
                const Icon = tab.icon;
                return (
                    <button
                        type="button"
                        key={tab.id}
                        onClick={() => onChange(tab.id)}
                        title={typeof tab.label === "string" ? tab.label : undefined}
                        className={`flex flex-1 items-center justify-center gap-1 rounded-xl border-none px-1.5 py-2 text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer select-none sm:gap-2 sm:px-3 md:text-xs ${
                            fit ? "min-w-0" : "shrink-0 snap-align-start"
                        } ${
                            isActive
                                ? "bg-accent font-black text-white shadow-md"
                                : "bg-transparent text-[var(--text-muted)] hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-main)]"
                        }`}
                    >
                        {Icon && (
                            <Icon
                                className={`h-3.5 w-3.5 shrink-0 transition-colors md:h-4 md:w-4 ${
                                    isActive ? "text-white" : "text-[var(--text-main)]"
                                }`}
                            />
                        )}
                        <span className={fit ? "min-w-0 truncate" : undefined}>{tab.label}</span>
                        {tab.badge !== undefined && tab.badge > 0 && (
                            <span
                                className="relative inline-flex min-w-5 items-center justify-center rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] font-black leading-none text-white shadow-sm shadow-red-500/30"
                            >
                                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-60" />
                                <span className="relative">{tab.badge > 99 ? "99+" : tab.badge}</span>
                            </span>
                        )}
                        {tab.attention && !tab.badge && (
                            <span className="relative flex h-2.5 w-2.5">
                                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-60" />
                                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-red-500" />
                            </span>
                        )}
                    </button>
                );
            })}
        </div>
    );
}
