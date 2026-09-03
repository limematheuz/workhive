"use client";

import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { SidebarContent, SidebarGroup, SidebarGroupContent, SidebarMenu, SidebarMenuBadge, SidebarMenuButton, SidebarMenuItem, SidebarMenuSub, SidebarMenuSubButton, useSidebar } from "@/components/ui/sidebar";
import { formatSidebarAlertCount, shouldShowTaskAlertsOnHref } from "@/lib/sidebar-alerts";
import type { NavGroup, NavLink } from "./sidebar-nav-config";

type SidebarNavigationProps = {
    pathname: string;
    plainLinks: NavLink[];
    navGroups: NavGroup[];
    visibleNavLinks: NavLink[];
    pendingRequestsCount: number;
    taskPendingCount: number;
    reportAlertsCount: number;
    openGroups: Record<string, boolean>;
    onOpenGroupChange: (groupId: string, open: boolean) => void;
};

export function SidebarNavigation(props: SidebarNavigationProps) {
    const { state } = useSidebar();
    const isActive = (href: string, exact: boolean) => exact ? props.pathname === href : props.pathname.startsWith(href);
    const alertCount = (href: string) => href === "/dashboard/reservations" ? props.pendingRequestsCount : shouldShowTaskAlertsOnHref(href) ? props.taskPendingCount : href === "/dashboard/task-reports" ? props.reportAlertsCount : 0;

    const link = (item: NavLink, nested = false) => {
        const count = alertCount(item.href);
        if (nested) return <SidebarMenuSubButton asChild isActive={isActive(item.href, item.exact)}><Link href={item.href}><span>{item.label}</span>{count > 0 && <span className="ml-auto rounded-md bg-[var(--sidebar-active-bg)] px-1.5 text-[10px] font-bold text-[var(--sidebar-active-text)]">{formatSidebarAlertCount(count)}</span>}</Link></SidebarMenuSubButton>;
        return <SidebarMenuButton asChild isActive={isActive(item.href, item.exact)} tooltip={item.label}><Link href={item.href}><span className="size-5 shrink-0 [&>svg]:size-5">{item.icon}</span>{state !== "collapsed" && <span>{item.label}</span>}{count > 0 && state !== "collapsed" && <SidebarMenuBadge className="rounded-md bg-[var(--sidebar-active-bg)] px-1.5 py-0.5 text-[10px] font-bold text-[var(--sidebar-active-text)]">{formatSidebarAlertCount(count)}</SidebarMenuBadge>}</Link></SidebarMenuButton>;
    };

    if (state === "collapsed") return <SidebarContent className="overflow-y-auto pt-2 md:overflow-y-auto"><SidebarMenu>{props.visibleNavLinks.map(item => <SidebarMenuItem key={item.href}>{link(item)}</SidebarMenuItem>)}</SidebarMenu></SidebarContent>;

    return <SidebarContent className="pb-1 pt-0.5">
        <SidebarMenu className="mb-1">{props.plainLinks.map(item => <SidebarMenuItem key={item.href}>{link(item)}</SidebarMenuItem>)}</SidebarMenu>
        {props.navGroups.map(group => {
            const active = group.children.some(item => isActive(item.href, item.exact));
            // The active section starts expanded, but the user must be able to
            // close it while remaining on one of its pages.
            const open = props.openGroups[group.id] ?? active;
            return <SidebarGroup key={group.id} className="py-0">
                <Collapsible open={open} onOpenChange={value => props.onOpenGroupChange(group.id, value)}>
                    <CollapsibleTrigger className={`flex h-9 w-full items-center gap-2 rounded-lg px-2 text-left text-[11px] font-semibold uppercase tracking-[0.12em] transition-colors hover:bg-[var(--bg-tertiary)] ${active ? "text-[var(--text-main)]" : "text-[var(--text-muted)]"}`}>
                        <span className="[&>svg]:size-4">{group.icon}</span><span className="flex-1">{group.label}</span><ChevronDown className={`size-4 transition-transform ${open ? "rotate-180" : ""}`} />
                    </CollapsibleTrigger>
                    <CollapsibleContent><SidebarGroupContent><SidebarMenuSub className="border-[var(--text-muted)]/70">{group.children.map(item => <li key={item.href}>{link(item, true)}</li>)}</SidebarMenuSub></SidebarGroupContent></CollapsibleContent>
                </Collapsible>
            </SidebarGroup>;
        })}
    </SidebarContent>;
}
