"use client";

import { startTransition, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ChevronUp, LogOut, UserRound } from "lucide-react";
import { usePathname } from "next/navigation";
import { useDictionary } from "@/lib/dictionary-context";
import { useUser } from "@/lib/user-context";
import { TaskService } from "@/services/task.service";
import { useBackgroundPolling } from "@/hooks/useBackgroundPolling";
import { POLL_INTERVALS } from "@/lib/polling";
import { canAdministerCompany, canManageCompanyTasks, canViewFinance, isAccountantRole, isPlatformSuperadmin } from "@/domain/access/roles";
import { CompanyPlanAccessService } from "@/services/company-plan-access.service";
import { NotificationService } from "@/services/notification.service";
import { NOTIFICATIONS_UPDATED_EVENT } from "./notifications/notification-utils";
import { countOperationalPendingTasks } from "@/lib/operational-task-count";
import { countUnreadTaskReportNotifications } from "@/lib/task-reporting";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Sidebar as ShadcnSidebar, SidebarFooter, SidebarHeader, SidebarMenu, SidebarMenuButton, SidebarMenuItem, useSidebar } from "@/components/ui/sidebar";
import { UserAvatar } from "@/components/ui/user-avatar";
import { buildSidebarNavLinks } from "./sidebar-nav-config";
import { SidebarLogo } from "./SidebarLogo";
import { SidebarNavigation } from "./SidebarNavigation";
import { SidebarFooterControls } from "./SidebarFooterControls";

type SidebarProps = { theme: "dark" | "light"; onThemeChange: (theme: "dark" | "light") => void; onLogout: () => void };

export function Sidebar({ theme, onThemeChange, onLogout }: SidebarProps) {
    const { dict, locale, setLocale } = useDictionary();
    const { user } = useUser();
    const pathname = usePathname();
    const { isMobile, state } = useSidebar();
    const [pendingRequestsCount, setPendingRequestsCount] = useState(0);
    const [taskPendingCount, setTaskPendingCount] = useState(0);
    const [reportAlertsCount, setReportAlertsCount] = useState(0);
    const [loadedFeatures, setLoadedFeatures] = useState<{
        context: string;
        values: Set<string> | null;
    } | null>(null);
    const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});
    const isAdminOrManager = canManageCompanyTasks(user);
    const isCompanyAdmin = canAdministerCompany(user);
    const isAccountant = isAccountantRole(user?.role?.name);
    const userIsPlatformSuperadmin = isPlatformSuperadmin(user);
    const featureContext = user && !userIsPlatformSuperadmin && !isAccountant
        ? `${user.id}:${user.company_id ?? "none"}`
        : null;

    useEffect(() => {
        if (!featureContext) return;
        let cancelled = false;
        void CompanyPlanAccessService.getCurrentEntitlements().then(access => {
            if (cancelled) return;
            const grantedFeatures = new Set<string>();
            for (const entitlement of access.entitlements) {
                if (entitlement.value_type === "boolean" && entitlement.value === true) {
                    grantedFeatures.add(entitlement.code);
                }
            }
            setLoadedFeatures({ context: featureContext, values: grantedFeatures });
        }).catch(() => {
            if (!cancelled) setLoadedFeatures({ context: featureContext, values: null });
        });
        return () => { cancelled = true; };
    }, [featureContext]);

    const enabledFeatures = loadedFeatures?.context === featureContext
        ? loadedFeatures.values
        : null;

    const refreshPending = useCallback(async () => {
        if (!isAdminOrManager || userIsPlatformSuperadmin) return setPendingRequestsCount(0);
        try { setPendingRequestsCount((await TaskService.getTaskItems({ status: "requested" })).filter(task => task.status === "requested").length); } catch { /* navigation stays available */ }
    }, [isAdminOrManager, userIsPlatformSuperadmin]);
    const refreshTasks = useCallback(async () => {
        if (!user || userIsPlatformSuperadmin || isAccountant) return setTaskPendingCount(0);
        try { setTaskPendingCount(countOperationalPendingTasks(await TaskService.getAllTaskItems(), user.id, isAdminOrManager)); } catch { /* keep last count */ }
    }, [isAccountant, isAdminOrManager, user, userIsPlatformSuperadmin]);
    const refreshReports = useCallback(async () => {
        if (!user || isAccountant) return setReportAlertsCount(0);
        try { setReportAlertsCount(countUnreadTaskReportNotifications(await NotificationService.listUnread())); } catch { /* keep last count */ }
    }, [isAccountant, user]);
    useEffect(() => { startTransition(() => { void refreshPending(); void refreshTasks(); void refreshReports(); }); }, [refreshPending, refreshReports, refreshTasks]);
    useEffect(() => { const refresh = () => void refreshReports(); window.addEventListener(NOTIFICATIONS_UPDATED_EVENT, refresh); return () => window.removeEventListener(NOTIFICATIONS_UPDATED_EVENT, refresh); }, [refreshReports]);
    useEffect(() => { const refresh = () => void refreshTasks(); window.addEventListener("workhive:tasks-changed", refresh); window.addEventListener("workhive:session-changed", refresh); return () => { window.removeEventListener("workhive:tasks-changed", refresh); window.removeEventListener("workhive:session-changed", refresh); }; }, [refreshTasks]);
    useBackgroundPolling(refreshPending, POLL_INTERVALS.sidebar);
    useBackgroundPolling(refreshTasks, POLL_INTERVALS.sidebarTaskCount);
    useBackgroundPolling(refreshReports, POLL_INTERVALS.sidebar);

    const navigation = buildSidebarNavLinks(dict, { isAdminOrManager, isCompanyAdmin, canViewFinance: canViewFinance(user), isAccountant, userIsPlatformSuperadmin, enabledFeatures });
    const expanded = state === "expanded";
    return <ShadcnSidebar collapsible="icon" id="tour-sidebar">
        <SidebarHeader className="border-b border-[var(--border-soft)]"><SidebarLogo isOpen={expanded} /></SidebarHeader>
        <SidebarNavigation pathname={pathname} {...navigation} pendingRequestsCount={pendingRequestsCount} taskPendingCount={taskPendingCount} reportAlertsCount={reportAlertsCount} openGroups={openGroups} onOpenGroupChange={(id, open) => setOpenGroups(current => ({ ...current, [id]: open }))} />
        <SidebarFooter>
            <SidebarFooterControls isOpen={expanded} theme={theme} locale={locale} onThemeChange={onThemeChange} onLocaleChange={setLocale} />
            {user && <SidebarMenu>
                <SidebarMenuItem>
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <SidebarMenuButton tooltip="Perfil y preferencias" className="h-11"><UserAvatar name={user.full_name} email={user.email} photoUrl={user.photo_url} className="size-7 shrink-0" />{expanded && <><span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold">{user.full_name || "Usuario"}</span><span className="block truncate text-xs text-[var(--text-muted)]">{user.role?.name || "Sin rol"}</span></span><ChevronUp className="size-4" /></>}</SidebarMenuButton>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent side={isMobile ? "top" : "right"} align={isMobile ? "start" : "end"} sideOffset={10} className="sidebar-account-menu w-60 rounded-2xl p-0">
                            <div className="flex min-w-0 items-center gap-2.5 px-3 py-3"><UserAvatar name={user.full_name} email={user.email} photoUrl={user.photo_url} className="size-9 shrink-0" /><div className="min-w-0"><p className="truncate text-sm font-semibold text-[var(--text-main)]">{user.full_name || "Usuario"}</p><p className="truncate text-xs text-[var(--text-muted)]">{user.email}</p></div></div>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem asChild className="h-10 rounded-none px-3 text-sm"><Link href="/dashboard/profile"><UserRound className="size-4" />{dict.dashboard.view_profile}</Link></DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem variant="destructive" onSelect={onLogout} className="h-10 rounded-none px-3 text-sm"><LogOut className="size-4" />{dict.dashboard.logout}</DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </SidebarMenuItem>
            </SidebarMenu>}
        </SidebarFooter>
    </ShadcnSidebar>;
}
