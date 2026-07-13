"use client";

import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import type { NavGroup, NavLink } from "./sidebar-nav-config";

type SidebarNavigationProps = {
    isOpen: boolean;
    pathname: string;
    plainLinks: NavLink[];
    navGroups: NavGroup[];
    visibleNavLinks: NavLink[];
    pendingRequestsCount: number;
    taskAlertsCount: number;
    openGroups: Record<string, boolean>;
    onOpenGroupChange: (groupId: string, open: boolean) => void;
};

export function SidebarNavigation({
    isOpen,
    pathname,
    plainLinks,
    navGroups,
    visibleNavLinks,
    pendingRequestsCount,
    taskAlertsCount,
    openGroups,
    onOpenGroupChange,
}: SidebarNavigationProps) {
    const isActive = (href: string, exact: boolean) =>
        exact ? pathname === href : pathname.includes(href);

    const renderNavLink = (link: NavLink, nested = false) => (
        <Link
            key={link.href}
            href={link.href}
            className={`group flex items-center gap-2 rounded-lg font-medium transition-all ${
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
            {!nested && (
                <span className="relative flex-shrink-0">
                    {link.icon}
                    {link.href === "/dashboard/reservations" && pendingRequestsCount > 0 && (
                        <span className="absolute -right-2.5 -top-2.5 flex min-h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-black leading-none text-white ring-2 ring-[var(--bg-card)]">
                            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-60"></span>
                            <span className="relative">{pendingRequestsCount > 9 ? "9+" : pendingRequestsCount}</span>
                        </span>
                    )}
                    {link.href === "/dashboard/tasks" && taskAlertsCount > 0 && (
                        <span className="absolute -right-2.5 -top-2.5 flex min-h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-black leading-none text-white ring-2 ring-[var(--bg-card)]">
                            {taskAlertsCount > 9 ? "9+" : taskAlertsCount}
                        </span>
                    )}
                </span>
            )}
            {isOpen && (
                <span className="flex min-w-0 flex-1 items-center gap-2 truncate">
                    <span className="truncate">{link.label}</span>
                    {link.href === "/dashboard/reservations" && pendingRequestsCount > 0 && (
                        <span className="ml-auto shrink-0 rounded-full bg-red-500 px-1.5 py-0.5 text-[9px] font-black text-white">
                            {pendingRequestsCount > 9 ? "9+" : pendingRequestsCount}
                        </span>
                    )}
                    {link.href === "/dashboard/tasks" && taskAlertsCount > 0 && (
                        <span className="ml-auto shrink-0 rounded-full bg-red-500 px-1.5 py-0.5 text-[9px] font-black text-white">
                            {taskAlertsCount > 9 ? "9+" : taskAlertsCount}
                        </span>
                    )}
                </span>
            )}
        </Link>
    );

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
                    className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left font-semibold transition-all ${
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
