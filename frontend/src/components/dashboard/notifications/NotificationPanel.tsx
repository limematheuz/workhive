"use client";

import { useEffect, useRef, useState } from "react";
import { Bell } from "lucide-react";

import { useDictionary } from "@/lib/dictionary-context";
import { useUser } from "@/lib/user-context";
import { isExternalPortalRole, isPartnerPortalRole } from "@/domain/access/roles";
import {
    HEADER_ALERT_BADGE_CLASS,
    HEADER_UPDATE_BADGE_CLASS,
    SIDEBAR_ALERT_PULSE_CLASS,
    SIDEBAR_UPDATE_PULSE_CLASS,
    formatSidebarAlertCount,
} from "@/lib/sidebar-alerts";
import type { NotificationTab } from "./notification-utils";
import { NotificationPopoverContent } from "./NotificationPopoverContent";
import { useNotifications } from "./useNotifications";

export function NotificationPanel() {
    const { dict, locale } = useDictionary();
    const { user } = useUser();
    const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
    const [activeNotificationTab, setActiveNotificationTab] = useState<NotificationTab>("primary");
    const notificationsRef = useRef<HTMLDivElement>(null);
    // Sponsored property managers deliberately have no access to the internal
    // notification feeds. Loading those feeds would return the expected 402
    // for their non-paying tenant and must never bounce them out of the portal.
    const enabled = Boolean(user)
        && !isExternalPortalRole(user?.role?.name)
        && !isPartnerPortalRole(user?.role?.name);
    const notifications = useNotifications({
        enabled,
        userId: user?.id,
        companyId: user?.company_id ?? undefined,
        roleName: user?.role?.name,
        dict,
        setIsNotificationsOpen,
    });

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (notificationsRef.current && !notificationsRef.current.contains(event.target as Node)) {
                setIsNotificationsOpen(false);
            }
        };
        if (isNotificationsOpen) document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [isNotificationsOpen]);

    if (!enabled) return null;

    const activeNotificationCount = activeNotificationTab === "primary"
        ? notifications.primaryNotificationCount
        : notifications.alertNotificationCount;
    const headerBadgeClass = notifications.hasAlertNotifications
        ? HEADER_ALERT_BADGE_CLASS
        : HEADER_UPDATE_BADGE_CLASS;
    const headerPulseClass = notifications.hasAlertNotifications
        ? SIDEBAR_ALERT_PULSE_CLASS
        : SIDEBAR_UPDATE_PULSE_CLASS;

    return (
        <div className="relative" ref={notificationsRef}>
            <button
                type="button"
                onClick={() => {
                    setIsNotificationsOpen((open) => !open);
                    void notifications.loadNotifications();
                }}
                className="relative cursor-pointer border-none bg-transparent p-0 text-[var(--text-muted)] transition-colors hover:text-[var(--text-main)]"
                aria-label="Notifications"
            >
                {notifications.totalNotificationCount > 0 && (
                    <span className={headerBadgeClass}>
                        <span className={headerPulseClass} />
                        <span className="relative">{formatSidebarAlertCount(notifications.totalNotificationCount)}</span>
                    </span>
                )}
                <Bell className="h-6 w-6" />
            </button>
            {isNotificationsOpen && (
                <NotificationPopoverContent
                    dict={dict}
                    locale={locale}
                    notifications={notifications}
                    activeTab={activeNotificationTab}
                    activeCount={activeNotificationCount}
                    onTabChange={setActiveNotificationTab}
                />
            )}
        </div>
    );
}
