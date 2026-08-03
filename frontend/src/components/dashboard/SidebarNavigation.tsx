"use client";

import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
    SIDEBAR_ALERT_COLLAPSED_BADGE_CLASS,
    SIDEBAR_ALERT_LINK_ACTIVE_CLASS,
    SIDEBAR_ALERT_LINK_CLASS,
    SIDEBAR_ALERT_PULSE_CLASS,
    SIDEBAR_ALERT_TRAILING_BADGE_CLASS,
    formatSidebarAlertCount,
    shouldShowTaskAlertsOnHref,
} from "@/lib/sidebar-alerts";
import type { NavGroup, NavLink } from "./sidebar-nav-config";

type SidebarNavigationProps = {
    isOpen: boolean;
    pathname: string;
    plainLinks: NavLink[];
    navGroups: NavGroup[];
    visibleNavLinks: NavLink[];
    pendingRequestsCount: number;
    taskAlertsCount: number;
    reportAlertsCount: number;
    openGroups: Record<string, boolean>;
    onOpenGroupChange: (groupId: string, open: boolean) => void;
};

function renderAlertBadge(count: number, className: string) {
    return (
        <span className={className}>
            <span className={SIDEBAR_ALERT_PULSE_CLASS} aria-hidden="true" />
            <span className="relative z-10">{formatSidebarAlertCount(count)}</span>
        </span>
    );
}

export function SidebarNavigation({
    isOpen,
    pathname,
    plainLinks,
    navGroups,
    visibleNavLinks,
    pendingRequestsCount,
    taskAlertsCount,
    reportAlertsCount,
    openGroups,
    onOpenGroupChange,
}: SidebarNavigationProps) {
    const isActive = (href: string, exact: boolean) =>
        exact ? pathname === href : pathname.includes(href);

    const showReservationAlerts = (href: string) =>
        href === "/dashboard/reservations" && pendingRequestsCount > 0;

    const showTaskAlerts = (href: string) =>
        shouldShowTaskAlertsOnHref(href) && taskAlertsCount > 0;

    const showReportAlerts = (href: string) =>
        href === "/dashboard/task-reports" && reportAlertsCount > 0;

    const renderNavLink = (link: NavLink, nested = false) => {
        const reservationAlerts = showReservationAlerts(link.href);
        const taskAlerts = showTaskAlerts(link.href);
        const reportAlerts = showReportAlerts(link.href);
        const alertCount = reservationAlerts
            ? pendingRequestsCount
            : taskAlerts
                ? taskAlertsCount
                : reportAlerts
                    ? reportAlertsCount
                : 0;
        const linkStackClass = alertCount > 0
            ? SIDEBAR_ALERT_LINK_ACTIVE_CLASS
            : SIDEBAR_ALERT_LINK_CLASS;

        return (
            <Link
                key={link.href}
                href={link.href}
                className={`group flex items-center gap-2 rounded-lg font-medium ui-motion ${linkStackClass} ${
                    nested ? "px-2 py-1.5 text-[13px]" : "px-2 py-1.5"
                } ${
                    isActive(link.href, link.exact)
                        ? ""
                        : "text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-tertiary)]"
                }`}
                style={
                    isActive(link.href, link.exact)
                        ? {
                              backgroundColor: "var(--sidebar-active-bg)",
                              color: "var(--sidebar-active-text)",
                              border: "1px solid var(--sidebar-active-border)",
                          }
                        : {}
                }
            >
                {!nested && <span className="relative z-0 flex-shrink-0">{link.icon}</span>}
                {isOpen && (
                    <span className="relative z-0 flex min-w-0 flex-1 items-center gap-2 overflow-visible">
                        <span className="min-w-0 truncate">{link.label}</span>
                        {alertCount > 0 &&
                            renderAlertBadge(alertCount, SIDEBAR_ALERT_TRAILING_BADGE_CLASS)}
                    </span>
                )}
                {!isOpen &&
                    !nested &&
                    alertCount > 0 &&
                    renderAlertBadge(alertCount, SIDEBAR_ALERT_COLLAPSED_BADGE_CLASS)}
            </Link>
        );
    };

    const renderNavGroup = (group: NavGroup) => {
        const groupActive = group.children.some(link => isActive(link.href, link.exact));
        const groupOpen = openGroups[group.id] ?? true;
        return (
            <Collapsible
                key={group.id}
                open={groupOpen}
                onOpenChange={(open) => onOpenGroupChange(group.id, open)}
                className="space-y-0.5"
            >
                <CollapsibleTrigger
                    className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left font-semibold ui-motion ${
                        groupActive
                            ? "text-[var(--text-main)]"
                            : "text-[var(--text-muted)] hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-main)]"
                    }`}
                >
                    <span className="flex-shrink-0">{group.icon}</span>
                    <span className="min-w-0 flex-1 truncate">{group.label}</span>
                    <ChevronDown className={`h-3.5 w-3.5 flex-shrink-0 transition-transform ${groupOpen ? "rotate-180" : ""}`} />
                </CollapsibleTrigger>
                <CollapsibleContent className="ml-4 border-l border-current/30 pl-2.5 text-[var(--text-muted)] data-[state=closed]:animate-none data-[state=open]:animate-none">
                    <div className="space-y-0.5 py-0.5">
                        {group.children.map(link => renderNavLink(link, true))}
                    </div>
                </CollapsibleContent>
            </Collapsible>
        );
    };

    return (
        <nav className="relative z-0 flex-1 min-h-0 overflow-y-auto px-2 pb-2 max-lg:pt-6 lg:pt-3.5 space-y-0.5 text-[13px]">
            {isOpen ? (
                <>
                    {plainLinks.map(link => renderNavLink(link))}
                    {navGroups.map(group => renderNavGroup(group))}
                </>
            ) : (
                visibleNavLinks.map(link => renderNavLink(link))
            )}
        </nav>
    );
}
