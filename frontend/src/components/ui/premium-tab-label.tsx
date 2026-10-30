import type { TabOption } from "./premium-tabs";

export function PremiumTabLabel<T extends string>({ tab, active = false, compact = true }: {
    tab: TabOption<T>; active?: boolean; compact?: boolean;
}) {
    const Icon = tab.icon;
    return <>
        {Icon && <Icon aria-hidden="true" className={`h-3.5 w-3.5 shrink-0 ${active ? "text-white" : "text-[var(--text-main)]"}`} />}
        <span className={compact ? "whitespace-nowrap" : "min-w-0 whitespace-normal"}>
            {compact && tab.compactLabel ? <span className="sm:hidden">{tab.compactLabel}</span> : null}
            <span className={compact && tab.compactLabel ? "hidden sm:inline" : undefined}>{tab.label}</span>
        </span>
        {tab.badge !== undefined && tab.badge > 0 && <span className={`relative inline-flex min-w-5 shrink-0 items-center justify-center rounded-full px-1.5 py-0.5 text-[10px] font-black leading-none text-white shadow-sm ${tab.badgeTone === "info" ? "bg-accent shadow-accent/30" : "bg-[var(--btn-cancel-hover-bg)] shadow-[var(--btn-cancel-bg)]"}`}>
            <span aria-hidden="true" className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-60 ${tab.badgeTone === "info" ? "bg-accent/70" : "bg-[var(--btn-cancel-hover-bg)]"}`} />
            <span className="relative">{tab.badge > 99 ? "99+" : tab.badge}</span>
        </span>}
        {tab.attention && !tab.badge && <span className="relative flex h-2.5 w-2.5 shrink-0" aria-hidden="true">
            <span aria-hidden="true" className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--btn-cancel-hover-bg)] opacity-60" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-[var(--btn-cancel-hover-bg)]" />
        </span>}
    </>;
}
