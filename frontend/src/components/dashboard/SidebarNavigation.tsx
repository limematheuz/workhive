"use client";

import { Fragment } from "react";
import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
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

const navigationIcon = (value: NavLink["icon"]) => <span aria-hidden="true" className="wh-navigation-icon">{value}</span>;
const navigationBadge = (count: number) => count > 0
    ? <span className="wh-navigation-badge">{formatSidebarAlertCount(count)}</span>
    : null;

export function SidebarNavigation(props: SidebarNavigationProps) {
    const { state, isMobile, setOpenMobile } = useSidebar();
    const collapsed = state === "collapsed" && !isMobile;
    const isActive = (href: string, exact: boolean) => exact
        ? props.pathname === href
        : props.pathname === href || props.pathname.startsWith(href + "/");
    const alertCount = (href: string) => href === "/dashboard/reservations"
        ? props.pendingRequestsCount
        : shouldShowTaskAlertsOnHref(href)
            ? props.taskPendingCount
            : href === "/dashboard/task-reports" ? props.reportAlertsCount : 0;
    const closeMobileNavigation = () => { if (isMobile) setOpenMobile(false); };

    const link = (item: NavLink, nested = false) => {
        const count = alertCount(item.href);
        if (nested) return <SidebarMenuSubButton asChild isActive={isActive(item.href, item.exact)}>
            <Link href={item.href} onClick={closeMobileNavigation} aria-current={isActive(item.href, item.exact) ? "page" : undefined}>
                {navigationIcon(item.icon)}<span className="min-w-0 flex-1 truncate">{item.label}</span>{navigationBadge(count)}
            </Link>
        </SidebarMenuSubButton>;
        return <SidebarMenuButton asChild isActive={isActive(item.href, item.exact)} tooltip={item.label}>
            <Link href={item.href} onClick={closeMobileNavigation} aria-label={collapsed ? item.label : undefined} aria-current={isActive(item.href, item.exact) ? "page" : undefined}>
                {navigationIcon(item.icon)}{!collapsed && <span className="min-w-0 flex-1 truncate">{item.label}</span>}
                {count > 0 && !collapsed && <SidebarMenuBadge className="wh-navigation-badge">{formatSidebarAlertCount(count)}</SidebarMenuBadge>}
            </Link>
        </SidebarMenuButton>;
    };

    // Compact navigation keeps every destination reachable through its group.
    if (collapsed) return <SidebarContent className="wh-navigation wh-navigation-compact !overflow-y-auto overscroll-contain sidebar-navigation-scroll md:!overflow-y-auto">
        <SidebarMenu>
            {props.plainLinks.map(item => <SidebarMenuItem key={item.href}>{link(item)}</SidebarMenuItem>)}
            {props.navGroups.map(group => <SidebarMenuItem key={group.id}>
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <SidebarMenuButton tooltip={group.label} aria-label={group.label} isActive={group.children.some(item => isActive(item.href, item.exact))}>
                            {navigationIcon(group.icon)}
                        </SidebarMenuButton>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent aria-label={group.label} side="right" align="start" sideOffset={12} className="wh-navigation-popover w-64">
                        <p role="presentation" data-slot="dropdown-menu-label">{group.label}</p>
                        {group.children.map(item => <DropdownMenuItem key={item.href} asChild>
                            <Link href={item.href} onClick={closeMobileNavigation} aria-current={isActive(item.href, item.exact) ? "page" : undefined}>
                                {navigationIcon(item.icon)}<span className="min-w-0 flex-1 truncate">{item.label}</span>{navigationBadge(alertCount(item.href))}
                            </Link>
                        </DropdownMenuItem>)}
                    </DropdownMenuContent>
                </DropdownMenu>
            </SidebarMenuItem>)}
        </SidebarMenu>
    </SidebarContent>;

    return <SidebarContent className="wh-navigation !overflow-y-auto overscroll-contain sidebar-navigation-scroll md:!overflow-y-auto">
        {props.plainLinks.length > 0 && <SidebarMenu className="mb-1">{props.plainLinks.map(item => <SidebarMenuItem key={item.href}>{link(item)}</SidebarMenuItem>)}</SidebarMenu>}
        {props.navGroups.map((group, index) => {
            const active = group.children.some(item => isActive(item.href, item.exact));
            const open = props.openGroups[group.id] ?? active;
            const startsSection = index === 0 || props.navGroups[index - 1].section !== group.section;
            return <Fragment key={group.id}>
                {startsSection && <p className="wh-navigation-section">{group.sectionLabel}</p>}
                <SidebarGroup className="py-0">
                    <Collapsible open={open} onOpenChange={value => props.onOpenGroupChange(group.id, value)}>
                        <CollapsibleTrigger data-active={active || undefined} className="wh-navigation-group-trigger">
                            {navigationIcon(group.icon)}<span className="min-w-0 flex-1 truncate">{group.label}</span>
                            <ChevronDown aria-hidden="true" className={`size-3.5 opacity-60 transition-transform ${open ? "rotate-180" : ""}`} />
                        </CollapsibleTrigger>
                        <CollapsibleContent className="sidebar-group-content overflow-hidden data-[state=closed]:animate-[sidebar-group-close_130ms_ease-in] data-[state=open]:animate-[sidebar-group-open_160ms_ease-out]">
                            <SidebarGroupContent><SidebarMenuSub>{group.children.map(item => <li key={item.href}>{link(item, true)}</li>)}</SidebarMenuSub></SidebarGroupContent>
                        </CollapsibleContent>
                    </Collapsible>
                </SidebarGroup>
            </Fragment>;
        })}
    </SidebarContent>;
}
