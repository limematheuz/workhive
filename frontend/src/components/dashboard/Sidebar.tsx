"use client";

import { usePathname } from "next/navigation";
import { startTransition, useCallback, useState, useEffect } from "react";
import { useDictionary } from "@/lib/dictionary-context";
import { useUser } from "@/lib/user-context";
import { TaskService } from "@/services/task.service";
import { useBackgroundPolling } from "@/hooks/useBackgroundPolling";
import { POLL_INTERVALS } from "@/lib/polling";
import {
    canAdministerCompany,
    canManageCompanyTasks,
    isPlatformSuperadmin,
    isSuperadmin,
} from "@/domain/access/roles";
import { buildSidebarNavLinks } from "./sidebar-nav-config";
import { SidebarLogo } from "./SidebarLogo";
import { SidebarNavigation } from "./SidebarNavigation";
import { SidebarFooterControls } from "./SidebarFooterControls";
import { NotificationService } from "@/services/notification.service";
import {
    countUnreadTaskNotifications,
    countUnreadTaskReportNotifications,
} from "@/lib/task-reporting";
import { NOTIFICATIONS_UPDATED_EVENT } from "./notifications/notification-utils";

interface SidebarProps {
    isOpen: boolean;
    theme: "dark" | "light";
    onThemeChange: (theme: "dark" | "light") => void;
    onLogout: () => void;
}

export function Sidebar({ isOpen, theme, onThemeChange, onLogout }: SidebarProps) {
    const { dict, locale, setLocale } = useDictionary();
    const pathname = usePathname();
    const { user } = useUser();

    const [pendingRequestsCount, setPendingRequestsCount] = useState(0);
    const [taskAlertsCount, setTaskAlertsCount] = useState(0);
    const [reportAlertsCount, setReportAlertsCount] = useState(0);
    const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({
        sales: true,
        finance: true,
    });

    const isAdminOrManager = canManageCompanyTasks(user);
    const isCompanyAdmin = canAdministerCompany(user);
    const userIsSuperadmin = isSuperadmin(user);
    const userIsPlatformSuperadmin = isPlatformSuperadmin(user);

    const fetchPendingRequests = useCallback(async () => {
        try {
            const tasks = await TaskService.getTaskItems({ status: "requested" });
            setPendingRequestsCount(tasks.filter(t => t.status === "requested").length);
        } catch {
            // silently fail
        }
    }, []);

    const fetchTaskAlerts = useCallback(async () => {
        if (!user) return;
        try {
            const notifications = await NotificationService.listUnread();
            setTaskAlertsCount(countUnreadTaskNotifications(notifications));
            setReportAlertsCount(countUnreadTaskReportNotifications(notifications));
        } catch {
            // Keep navigation available during transient API failures.
        }
    }, [user]);

    useEffect(() => {
        if (!isAdminOrManager || userIsPlatformSuperadmin) return;
        startTransition(() => {
            void fetchPendingRequests();
        });
    }, [fetchPendingRequests, isAdminOrManager, userIsPlatformSuperadmin]);

    useEffect(() => {
        startTransition(() => { void fetchTaskAlerts(); });
    }, [fetchTaskAlerts]);

    useEffect(() => {
        const refresh = () => { void fetchTaskAlerts(); };
        window.addEventListener(NOTIFICATIONS_UPDATED_EVENT, refresh);
        return () => window.removeEventListener(NOTIFICATIONS_UPDATED_EVENT, refresh);
    }, [fetchTaskAlerts]);

    useBackgroundPolling(async () => {
        if (!isAdminOrManager || userIsPlatformSuperadmin) return;
        await fetchPendingRequests();
    }, POLL_INTERVALS.sidebar);

    useBackgroundPolling(fetchTaskAlerts, POLL_INTERVALS.sidebar);

    const { visibleNavLinks, navGroups, plainLinks } = buildSidebarNavLinks(dict, {
        isAdminOrManager,
        isCompanyAdmin,
        userIsSuperadmin,
        userIsPlatformSuperadmin,
    });

    return (
        <aside
            id="tour-sidebar"
            className={`fixed lg:relative z-[var(--z-sidebar)] h-full flex flex-col transition-all duration-300 ease-in-out ${
                isOpen ? "translate-x-0 w-60 max-lg:z-[var(--z-sidebar-mobile-open)]" : "-translate-x-full w-60 lg:translate-x-0 lg:w-20"
            } sidebar-mobile-bg`}
        >
            <SidebarLogo isOpen={isOpen} />

            <SidebarNavigation
                isOpen={isOpen}
                pathname={pathname}
                plainLinks={plainLinks}
                navGroups={navGroups}
                visibleNavLinks={visibleNavLinks}
                pendingRequestsCount={pendingRequestsCount}
                taskAlertsCount={taskAlertsCount}
                reportAlertsCount={reportAlertsCount}
                openGroups={openGroups}
                onOpenGroupChange={(groupId, open) =>
                    setOpenGroups(current => ({ ...current, [groupId]: open }))
                }
            />

            <SidebarFooterControls
                isOpen={isOpen}
                theme={theme}
                locale={locale}
                logoutLabel={dict.dashboard.logout}
                onThemeChange={onThemeChange}
                onLocaleChange={setLocale}
                onLogout={onLogout}
            />
        </aside>
    );
}
