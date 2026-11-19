export function premiumTabTriggerClass(active: boolean) {
    return `inline-flex flex-auto shrink-0 items-center justify-center gap-1.5 rounded-lg border-none px-2 py-2 text-xs font-semibold ui-motion cursor-pointer select-none sm:gap-2 sm:px-3 ${active
        ? "bg-accent font-semibold text-white shadow-sm"
        : "bg-transparent text-[var(--text-muted)] hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-main)]"}`;
}
