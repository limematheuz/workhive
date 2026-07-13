export const SIDEBAR_TASK_ALERT_HREFS = new Set([
    "/dashboard",
    "/dashboard/tasks",
]);

export const SIDEBAR_ALERT_ICON_BADGE_CLASS =
    "absolute -right-2.5 -top-2.5 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[9px] font-black leading-none text-white";

export const SIDEBAR_ALERT_TRAILING_BADGE_CLASS =
    "ml-auto flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-red-500 text-[9px] font-black leading-none text-white";

export const HEADER_ALERT_BADGE_CLASS =
    "absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[9px] font-black leading-none text-white shadow-lg shadow-red-500/30";

export function formatSidebarAlertCount(count: number): string {
    if (count > 9) return "9+";
    return String(count);
}

export function shouldShowTaskAlertsOnHref(href: string): boolean {
    return SIDEBAR_TASK_ALERT_HREFS.has(href);
}
