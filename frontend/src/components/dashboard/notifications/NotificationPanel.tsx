"use client";

import React, { useState, useEffect, useRef } from "react";
import { Bell, Inbox, Trash2, XCircle, CheckSquare } from "lucide-react";
import { useDictionary } from "@/lib/dictionary-context";
import { useUser } from "@/lib/user-context";
import { PremiumTabs } from "@/components/ui/premium-tabs";
import { useNotifications } from "./useNotifications";
import { NotificationItem } from "./NotificationItem";
import {
    NotificationTab,
    getCollaborationNotificationKey,
    getPrivacyRequestNotificationKey,
    getReservationNotificationKey,
    getTaskNotificationKey,
    getUpcomingArrivalNotificationKey,
} from "./notification-utils";
import {
    HEADER_ALERT_BADGE_CLASS,
    SIDEBAR_ALERT_PULSE_CLASS,
    formatSidebarAlertCount,
} from "@/lib/sidebar-alerts";

export function NotificationPanel() {
    const { dict, locale } = useDictionary();
    const { user } = useUser();
    const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
    const [activeNotificationTab, setActiveNotificationTab] = useState<NotificationTab>("primary");
    const notificationsRef = useRef<HTMLDivElement>(null);
    const enabled = Boolean(user);

    const {
        loadNotifications,
        persistentNotifications,
        primaryTaskNotifications,
        secondaryTaskNotifications,
        primaryCollaborationNotifications,
        privacyRequestNotifications,
        secondaryReservationNotifications,
        upcomingArrivalNotifications,
        primaryNotificationCount,
        secondaryNotificationCount,
        totalNotificationCount,
        openingNotificationKey,
        notificationReferenceTime,
        getNotificationLocationName,
        getNotificationPreview,
        handleClearActiveTab,
        handleTaskNotificationClick,
        handleCollaborationNotificationClick,
        handlePrivacyRequestClick,
        handleReservationNotificationClick,
        handleUpcomingArrivalClick,
        handlePersistentNotificationClick,
        upcomingArrivals,
    } = useNotifications({
        enabled,
        userId: user?.id,
        companyId: user?.company_id ?? undefined,
        roleName: user?.role?.name,
        dict,
        setIsNotificationsOpen,
    });

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (notificationsRef.current && !notificationsRef.current.contains(event.target as Node)) {
                setIsNotificationsOpen(false);
            }
        }
        if (isNotificationsOpen) {
            document.addEventListener("mousedown", handleClickOutside);
        }
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, [isNotificationsOpen]);

    const activeNotificationCount = activeNotificationTab === "primary"
        ? primaryNotificationCount
        : secondaryNotificationCount;

    if (!enabled) return null;

    return (
        <div className="relative" ref={notificationsRef}>
            <button type="button"
                onClick={() => {
                    setIsNotificationsOpen(!isNotificationsOpen);
                    void loadNotifications();
                }}
                className="text-[var(--text-muted)] hover:text-[var(--text-main)] transition-colors relative bg-transparent border-none cursor-pointer p-0"
                aria-label="Notifications"
            >
                {totalNotificationCount > 0 && (
                    <span className={HEADER_ALERT_BADGE_CLASS}>
                        <span className={SIDEBAR_ALERT_PULSE_CLASS} />
                        <span className="relative">{formatSidebarAlertCount(totalNotificationCount)}</span>
                    </span>
                )}
                <Bell className="w-6 h-6" />
            </button>

            {isNotificationsOpen && user && (
                <div className="surface-popover header-popover-layer fixed left-3 right-3 top-20 max-w-[calc(100vw-1.5rem)] rounded-3xl p-4 ui-motion sm:left-auto sm:right-8 sm:w-[min(25rem,calc(100vw-2rem))]">
                    <div className="flex items-start justify-between gap-4 pb-3">
                        <div>
                            <p className="text-sm font-black text-[var(--text-main)]">
                                {dict.notifications?.title || "Notificaciones"}
                            </p>
                            <p className="text-xs text-[var(--text-muted)] font-semibold mt-0.5">
                                {totalNotificationCount > 0
                                    ? (dict.notifications?.pending_alerts ? dict.notifications.pending_alerts.replace("{count}", totalNotificationCount.toString()) : `${totalNotificationCount} avisos pendientes`)
                                    : (dict.notifications?.no_new_notifications || "No tienes notificaciones nuevas")}
                            </p>
                        </div>
                        <button
                            type="button"
                            onClick={() => handleClearActiveTab(activeNotificationTab)}
                            disabled={activeNotificationCount === 0}
                            className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--border-soft)] bg-[var(--btn-neutral-bg)] px-2.5 py-2 text-xs font-bold text-[var(--text-muted)] transition-colors hover:bg-[var(--btn-neutral-hover-bg)] hover:text-[var(--text-main)] disabled:cursor-not-allowed disabled:opacity-40"
                        >
                            <Trash2 className="h-3.5 w-3.5" />
                            {dict.notifications?.clear_all || "Borrar todas"}
                        </button>
                    </div>

                    <PremiumTabs
                        tabs={[
                            {
                                id: "primary",
                                label: dict.notifications?.tabs?.primary || "Principal",
                                icon: Inbox,
                                badge: primaryNotificationCount,
                            },
                            {
                                id: "secondary",
                                label: dict.notifications?.tabs?.secondary || "Secundarias",
                                icon: XCircle,
                                badge: secondaryNotificationCount,
                            },
                        ]}
                        activeTab={activeNotificationTab}
                        onChange={setActiveNotificationTab}
                        className="mb-2"
                    />

                    <div className="max-h-[360px] overflow-y-auto py-2">
                        {activeNotificationCount === 0 ? (
                            <div className="py-8 text-center">
                                <CheckSquare className="mx-auto mb-2 h-5 w-5 text-[var(--text-main)] opacity-70" />
                                <p className="text-sm font-semibold text-[var(--text-main)]">
                                    {activeNotificationTab === "primary"
                                        ? (dict.notifications?.empty_primary || "No hay avisos principales.")
                                        : (dict.notifications?.empty_secondary || "No hay avisos secundarios.")}
                                </p>
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {activeNotificationTab === "primary" && (
                                    <>
                                        {persistentNotifications.map((notification) => (
                                            <NotificationItem
                                                key={`persistent:${notification.id}`}
                                                type="persistent"
                                                data={notification}
                                                notificationKey={`persistent:${notification.id}`}
                                                openingNotificationKey={openingNotificationKey}
                                                onClick={() => void handlePersistentNotificationClick(notification)}
                                                dict={dict}
                                                locale={locale}
                                            />
                                        ))}
                                        {primaryCollaborationNotifications.map((collab) => {
                                            const notificationKey = getCollaborationNotificationKey(collab);
                                            return (
                                                <NotificationItem
                                                    key={notificationKey}
                                                    type="collaboration"
                                                    data={collab}
                                                    notificationKey={notificationKey}
                                                    openingNotificationKey={openingNotificationKey}
                                                    onClick={() => void handleCollaborationNotificationClick(collab)}
                                                    dict={dict}
                                                    locale={locale}
                                                />
                                            );
                                        })}

                                        {privacyRequestNotifications.map((request) => {
                                            const notificationKey = getPrivacyRequestNotificationKey(request);
                                            return (
                                                <NotificationItem
                                                    key={notificationKey}
                                                    type="privacy-request"
                                                    data={request}
                                                    notificationKey={notificationKey}
                                                    openingNotificationKey={openingNotificationKey}
                                                    onClick={() => handlePrivacyRequestClick(request)}
                                                    dict={dict}
                                                    locale={locale}
                                                />
                                            );
                                        })}

                                        {upcomingArrivalNotifications.map((reservation) => {
                                            const notificationKey = getUpcomingArrivalNotificationKey(reservation);
                                            const arrivalAt = new Date(reservation.check_in_at);
                                            const hoursUntil = Math.max(
                                                0,
                                                Math.ceil((arrivalAt.getTime() - notificationReferenceTime) / (60 * 60 * 1000))
                                            );
                                            const timeLabel = hoursUntil < 24
                                                ? (dict.notifications?.time?.in_hours ? dict.notifications.time.in_hours.replace("{count}", hoursUntil.toString()) : `en ${hoursUntil} h`)
                                                : (dict.notifications?.time?.in_days ? dict.notifications.time.in_days.replace("{count}", Math.ceil(hoursUntil / 24).toString()) : `en ${Math.ceil(hoursUntil / 24)} días`);

                                            return (
                                                <NotificationItem
                                                    key={notificationKey}
                                                    type="arrival"
                                                    data={reservation}
                                                    notificationKey={notificationKey}
                                                    openingNotificationKey={openingNotificationKey}
                                                    onClick={() => void handleUpcomingArrivalClick(reservation)}
                                                    dict={dict}
                                                    locale={locale}
                                                    locationName={getNotificationLocationName(reservation.location_id)}
                                                    timeLabel={timeLabel}
                                                />
                                            );
                                        })}

                                        {primaryTaskNotifications.map((task) => {
                                            const notificationKey = getTaskNotificationKey(task);
                                            const linkedArrival = upcomingArrivals.find((reservation) => (
                                                reservation.id === task.checkout_reservation?.id
                                                || reservation.id === task.next_reservation?.id
                                            ));
                                            const linkedArrivalDate = linkedArrival
                                                ? new Date(linkedArrival.check_in_at).toLocaleString(locale === "en" ? "en-US" : "es-ES", {
                                                    day: "2-digit",
                                                    month: "short",
                                                    hour: "2-digit",
                                                    minute: "2-digit",
                                                })
                                                : null;

                                            return (
                                                <NotificationItem
                                                    key={notificationKey}
                                                    type="task"
                                                    data={task}
                                                    notificationKey={notificationKey}
                                                    openingNotificationKey={openingNotificationKey}
                                                    onClick={() => void handleTaskNotificationClick(task)}
                                                    dict={dict}
                                                    locale={locale}
                                                    locationName={getNotificationLocationName(task.location_id)}
                                                    previewText={getNotificationPreview(task)}
                                                    linkedArrivalDate={linkedArrivalDate}
                                                    linkedArrivalGuests={linkedArrival?.guest_count}
                                                />
                                            );
                                        })}
                                    </>
                                )}

                                {activeNotificationTab === "secondary" && (
                                    <>
                                        {secondaryTaskNotifications.map((task) => {
                                            const notificationKey = getTaskNotificationKey(task);
                                            return (
                                                <NotificationItem
                                                    key={notificationKey}
                                                    type="task-rejected"
                                                    data={task}
                                                    notificationKey={notificationKey}
                                                    openingNotificationKey={openingNotificationKey}
                                                    onClick={() => void handleTaskNotificationClick(task)}
                                                    dict={dict}
                                                    locale={locale}
                                                    locationName={getNotificationLocationName(task.location_id)}
                                                    previewText={getNotificationPreview(task)}
                                                />
                                            );
                                        })}

                                        {secondaryReservationNotifications.map((reservation) => {
                                            const notificationKey = getReservationNotificationKey(reservation);
                                            return (
                                                <NotificationItem
                                                    key={notificationKey}
                                                    type="reservation-cancelled"
                                                    data={reservation}
                                                    notificationKey={notificationKey}
                                                    openingNotificationKey={openingNotificationKey}
                                                    onClick={() => void handleReservationNotificationClick(reservation)}
                                                    dict={dict}
                                                    locale={locale}
                                                    locationName={getNotificationLocationName(reservation.location_id)}
                                                />
                                            );
                                        })}
                                    </>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
