export const SIDEBAR_TASK_ALERT_HREFS = new Set([
    "/dashboard",
    "/dashboard/tasks",
]);

/** Right-side badge used when the sidebar is expanded. */
export const SIDEBAR_ALERT_TRAILING_BADGE_CLASS =
    "relative z-20 ml-auto flex h-5 w-5 shrink-0 items-center justify-center overflow-visible rounded-full bg-red-500 text-[9px] font-black leading-none text-white";

/** Corner badge for the collapsed icon-only sidebar. */
export const SIDEBAR_ALERT_COLLAPSED_BADGE_CLASS =
    "absolute -right-1 -top-1 z-20 flex h-5 w-5 items-center justify-center overflow-visible rounded-full bg-red-500 text-[9px] font-black leading-none text-white";

export const HEADER_ALERT_BADGE_CLASS =
    "absolute -right-1 -top-1 z-20 flex h-5 w-5 items-center justify-center overflow-visible rounded-full bg-red-500 text-[9px] font-black leading-none text-white shadow-lg shadow-red-500/30";

export const SIDEBAR_ALERT_PULSE_CLASS =
    "pointer-events-none absolute inset-0 z-0 inline-flex animate-ping rounded-full bg-red-400 opacity-60";

export const SIDEBAR_ALERT_LINK_CLASS =
    "relative z-0 overflow-visible";

export const SIDEBAR_ALERT_LINK_ACTIVE_CLASS =
    "relative z-10 overflow-visible";

export function formatSidebarAlertCount(count: number): string {
    if (count > 9) return "9+";
    return String(count);
}

export function shouldShowTaskAlertsOnHref(href: string): boolean {
    return SIDEBAR_TASK_ALERT_HREFS.has(href);
}
