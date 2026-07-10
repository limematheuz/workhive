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
}

export function PremiumTabs<T extends string>({
    tabs,
    activeTab,
    onChange,
    className = "",
}: PremiumTabsProps<T>) {
    return (
        <div className={`flex bg-[var(--bg-primary)]/40 p-1 border border-[var(--border-soft)] rounded-2xl w-full gap-1 overflow-x-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] snap-x ${className}`}>
            {tabs.map((tab) => {
                const isActive = activeTab === tab.id;
                const Icon = tab.icon;
                return (
                    <button
                        type="button"
                        key={tab.id}
                        onClick={() => onChange(tab.id)}
                        className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-xl transition-all cursor-pointer border-none text-2xs md:text-xs font-bold uppercase tracking-wider select-none shrink-0 snap-align-start ${
                            isActive
                                ? "bg-accent text-white font-black shadow-md"
                                : "bg-transparent text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-tertiary)]"
                        }`}
                    >
                        {Icon && (
                            <Icon 
                                className={`w-3.5 h-3.5 md:w-4 md:h-4 shrink-0 transition-colors ${
                                    isActive ? "text-white" : "text-[var(--text-main)]"
                                }`} 
                            />
                        )}
                        <span>{tab.label}</span>
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
