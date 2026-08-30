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
    canViewFinance,
    canManageCompanyTasks,
    isAccountantRole,
    isPlatformSuperadmin,
} from "@/domain/access/roles";
import { buildSidebarNavLinks } from "./sidebar-nav-config";
import { SidebarLogo } from "./SidebarLogo";
import { SidebarNavigation } from "./SidebarNavigation";
import { SidebarFooterControls } from "./SidebarFooterControls";
import { NotificationService } from "@/services/notification.service";
import { CompanyPlanAccessService } from "@/services/company-plan-access.service";
import {
    countUnreadTaskReportNotifications,
} from "@/lib/task-reporting";
import { NOTIFICATIONS_UPDATED_EVENT } from "./notifications/notification-utils";
import { countOperationalPendingTasks } from "@/lib/operational-task-count";

interface SidebarProps {
    isOpen: boolean;
    theme: "dark" | "light";
    onThemeChange: (theme: "dark" | "light") => void;
}

export function Sidebar({ isOpen, theme, onThemeChange }: SidebarProps) {
    const { dict, locale, setLocale } = useDictionary();
    const pathname = usePathname();
    const { user } = useUser();

    const [pendingRequestsCount, setPendingRequestsCount] = useState(0);
    const [taskPendingCount, setTaskPendingCount] = useState(0);
    const [reportAlertsCount, setReportAlertsCount] = useState(0);
    const [enabledFeatures, setEnabledFeatures] = useState<Set<string> | null>(null);
    const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({
        sales: true,
        finance: true,
    });

    const isAdminOrManager = canManageCompanyTasks(user);
    const isCompanyAdmin = canAdministerCompany(user);
    const userCanViewFinance = canViewFinance(user);
    const isAccountant = isAccountantRole(user?.role?.name);
    const userIsPlatformSuperadmin = isPlatformSuperadmin(user);

    useEffect(() => {
        if (!user || userIsPlatformSuperadmin || isAccountant) {
            startTransition(() => setEnabledFeatures(null));
            return;
        }
        let cancelled = false;
        void CompanyPlanAccessService.getCurrentEntitlements()
            .then((access) => {
                if (!cancelled) {
                    setEnabledFeatures(new Set(
                        access.entitlements
                            .filter((item) => item.value_type === "boolean" && item.value === true)
                            .map((item) => item.code),
                    ));
                }
            })
            .catch(() => {
                // Keep navigation visible if a transient read fails; backend remains authoritative.
                if (!cancelled) setEnabledFeatures(null);
            });
        return () => {
            cancelled = true;
        };
    }, [isAccountant, user, userIsPlatformSuperadmin]);

    const fetchPendingRequests = useCallback(async () => {
        try {
            const tasks = await TaskService.getTaskItems({ status: "requested" });
            setPendingRequestsCount(tasks.filter(t => t.status === "requested").length);
        } catch {
            // silently fail
        }
    }, []);

    const fetchTaskPendingCount = useCallback(async () => {
        if (!user || userIsPlatformSuperadmin || isAccountant) {
            setTaskPendingCount(0);
            return;
        }
        try {
            const tasks = await TaskService.getAllTaskItems();
            setTaskPendingCount(
                countOperationalPendingTasks(tasks, user.id, isAdminOrManager),
            );
        } catch {
            // Keep the last known workload during a transient API failure.
        }
    }, [isAccountant, isAdminOrManager, user, userIsPlatformSuperadmin]);

    const fetchReportAlerts = useCallback(async () => {
        if (!user || isAccountant) return;
        try {
            const notifications = await NotificationService.listUnread();
            setReportAlertsCount(countUnreadTaskReportNotifications(notifications));
        } catch {
            // Keep navigation available during transient API failures.
        }
    }, [isAccountant, user]);

    useEffect(() => {
        if (!isAdminOrManager || userIsPlatformSuperadmin) return;
        startTransition(() => {
            void fetchPendingRequests();
        });
    }, [fetchPendingRequests, isAdminOrManager, userIsPlatformSuperadmin]);

    useEffect(() => {
        startTransition(() => { void fetchTaskPendingCount(); });
    }, [fetchTaskPendingCount]);

    useEffect(() => {
        startTransition(() => { void fetchReportAlerts(); });
    }, [fetchReportAlerts]);

    useEffect(() => {
        const refresh = () => { void fetchReportAlerts(); };
        window.addEventListener(NOTIFICATIONS_UPDATED_EVENT, refresh);
        return () => window.removeEventListener(NOTIFICATIONS_UPDATED_EVENT, refresh);
    }, [fetchReportAlerts]);

    useEffect(() => {
        const refresh = () => { void fetchTaskPendingCount(); };
        window.addEventListener("workhive:tasks-changed", refresh);
        window.addEventListener("workhive:session-changed", refresh);
        return () => {
            window.removeEventListener("workhive:tasks-changed", refresh);
            window.removeEventListener("workhive:session-changed", refresh);
        };
    }, [fetchTaskPendingCount]);

    useBackgroundPolling(async () => {
        if (!isAdminOrManager || userIsPlatformSuperadmin) return;
        await fetchPendingRequests();
    }, POLL_INTERVALS.sidebar);

    useBackgroundPolling(fetchTaskPendingCount, POLL_INTERVALS.sidebarTaskCount);
    useBackgroundPolling(fetchReportAlerts, POLL_INTERVALS.sidebar);

    const { visibleNavLinks, navGroups, plainLinks } = buildSidebarNavLinks(dict, {
        isAdminOrManager,
        isCompanyAdmin,
        canViewFinance: userCanViewFinance,
        isAccountant,
        userIsPlatformSuperadmin,
        enabledFeatures,
    });

    return (
        <aside
            id="tour-sidebar"
            className={`fixed lg:relative z-[var(--z-sidebar)] h-full flex flex-col ui-motion duration-300 ease-in-out ${
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
                taskPendingCount={taskPendingCount}
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
                onThemeChange={onThemeChange}
                onLocaleChange={setLocale}
            />
        </aside>
    );
}
