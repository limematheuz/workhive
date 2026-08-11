import { CheckCheck, CheckSquare, Inbox, TriangleAlert } from "lucide-react";

import { Button } from "@/components/ui/button";
import { PremiumTabs } from "@/components/ui/premium-tabs";
import type { Dictionary } from "@/lib/dictionary-context";
import type { NotificationTab } from "./notification-utils";
import {
    getCollaborationNotificationKey,
    getPrivacyRequestNotificationKey,
    getReservationNotificationKey,
    getTaskNotificationKey,
    getUpcomingArrivalNotificationKey,
} from "./notification-utils";
import { NotificationItem } from "./NotificationItem";
import type { useNotifications } from "./useNotifications";

type NotificationsState = ReturnType<typeof useNotifications>;

type NotificationPopoverContentProps = {
    dict: Dictionary;
    locale: string;
    notifications: NotificationsState;
    activeTab: NotificationTab;
    activeCount: number;
    onTabChange: (tab: NotificationTab) => void;
};

export function NotificationPopoverContent({
    dict,
    locale,
    notifications,
    activeTab,
    activeCount,
    onTabChange,
}: NotificationPopoverContentProps) {
    const {
        primaryPersistentNotifications,
        alertPersistentTaskNotifications,
        primaryTaskNotifications,
        alertTaskNotifications,
        primaryCollaborationNotifications,
        privacyRequestNotifications,
        secondaryReservationNotifications,
        upcomingArrivalNotifications,
        primaryNotificationCount,
        alertNotificationCount,
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
    } = notifications;

    return (
        <div className="billing-surface header-popover-layer fixed left-3 right-3 top-20 max-w-[calc(100vw-1.5rem)] rounded-[24px] p-3 ui-motion sm:left-auto sm:right-8 sm:w-[min(25rem,calc(100vw-2rem))]">
            <div className="flex items-start justify-between gap-2.5 pb-2">
                <div className="min-w-0">
                    <p className="text-sm font-semibold text-[var(--text-main)]">{dict.notifications?.title || "Notificaciones"}</p>
                    <p className="mt-0.5 text-xs text-[var(--text-muted)]">
                        {totalNotificationCount > 0
                            ? (dict.notifications?.pending_alerts ? dict.notifications.pending_alerts.replace("{count}", totalNotificationCount.toString()) : `${totalNotificationCount} avisos pendientes`)
                            : (dict.notifications?.no_new_notifications || "No tienes notificaciones nuevas")}
                    </p>
                </div>
                <Button type="button" variant="outline" size="xs" onClick={() => handleClearActiveTab(activeTab)} disabled={activeCount === 0} className="shrink-0 hover:translate-y-0">
                    <CheckCheck className="h-3.5 w-3.5" aria-hidden="true" />
                    {dict.notifications?.clear_all || "Marcar como vistas"}
                </Button>
            </div>
            <PremiumTabs
                layout="fit"
                tabs={[
                    { id: "primary", label: dict.notifications?.tabs?.primary || "Novedades", icon: Inbox, badge: primaryNotificationCount, badgeTone: "info" },
                    { id: "secondary", label: dict.notifications?.tabs?.secondary || "Alertas", icon: TriangleAlert, badge: alertNotificationCount, badgeTone: "danger" },
                ]}
                activeTab={activeTab}
                onChange={onTabChange}
                className="mb-1.5"
            />
            <div className="max-h-[360px] overflow-y-auto py-1">
                {activeCount === 0 ? (
                    <div className="billing-block rounded-xl border border-dashed border-[var(--border-soft)] px-3 py-4 text-center">
                        <CheckSquare className="mx-auto mb-1.5 h-4 w-4 text-[var(--text-muted)]" />
                        <p className="text-xs font-semibold text-[var(--text-main)]">
                            {activeTab === "primary"
                                ? (dict.notifications?.empty_primary || "No hay novedades pendientes.")
                                : (dict.notifications?.empty_secondary || "No hay alertas pendientes.")}
                        </p>
                    </div>
                ) : (
                    <div className="space-y-2">
                        {activeTab === "primary" && <>
                            {primaryPersistentNotifications.map((notification) => <NotificationItem key={`persistent:${notification.id}`} type="persistent" data={notification} notificationKey={`persistent:${notification.id}`} openingNotificationKey={openingNotificationKey} onClick={() => void handlePersistentNotificationClick(notification)} dict={dict} locale={locale} />)}
                            {primaryCollaborationNotifications.map((collaboration) => {
                                const notificationKey = getCollaborationNotificationKey(collaboration);
                                return <NotificationItem key={notificationKey} type="collaboration" data={collaboration} notificationKey={notificationKey} openingNotificationKey={openingNotificationKey} onClick={() => void handleCollaborationNotificationClick(collaboration)} dict={dict} locale={locale} />;
                            })}
                            {privacyRequestNotifications.map((request) => {
                                const notificationKey = getPrivacyRequestNotificationKey(request);
                                return <NotificationItem key={notificationKey} type="privacy-request" data={request} notificationKey={notificationKey} openingNotificationKey={openingNotificationKey} onClick={() => handlePrivacyRequestClick(request)} dict={dict} locale={locale} />;
                            })}
                            {upcomingArrivalNotifications.map((reservation) => {
                                const notificationKey = getUpcomingArrivalNotificationKey(reservation);
                                const hoursUntil = Math.max(0, Math.ceil((new Date(reservation.check_in_at).getTime() - notificationReferenceTime) / (60 * 60 * 1000)));
                                const timeLabel = hoursUntil < 24
                                    ? (dict.notifications?.time?.in_hours ? dict.notifications.time.in_hours.replace("{count}", hoursUntil.toString()) : `en ${hoursUntil} h`)
                                    : (dict.notifications?.time?.in_days ? dict.notifications.time.in_days.replace("{count}", Math.ceil(hoursUntil / 24).toString()) : `en ${Math.ceil(hoursUntil / 24)} días`);
                                return <NotificationItem key={notificationKey} type="arrival" data={reservation} notificationKey={notificationKey} openingNotificationKey={openingNotificationKey} onClick={() => void handleUpcomingArrivalClick(reservation)} dict={dict} locale={locale} locationName={getNotificationLocationName(reservation.location_id)} timeLabel={timeLabel} />;
                            })}
                            {primaryTaskNotifications.map((task) => {
                                const notificationKey = getTaskNotificationKey(task);
                                const linkedArrival = upcomingArrivals.find((reservation) => reservation.id === task.checkout_reservation?.id || reservation.id === task.next_reservation?.id);
                                const linkedArrivalDate = linkedArrival ? new Date(linkedArrival.check_in_at).toLocaleString(locale === "en" ? "en-US" : "es-ES", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : null;
                                return <NotificationItem key={notificationKey} type="task" data={task} notificationKey={notificationKey} openingNotificationKey={openingNotificationKey} onClick={() => void handleTaskNotificationClick(task)} dict={dict} locale={locale} locationName={getNotificationLocationName(task.location_id)} previewText={getNotificationPreview(task)} linkedArrivalDate={linkedArrivalDate} linkedArrivalGuests={linkedArrival?.guest_count} />;
                            })}
                        </>}
                        {activeTab === "secondary" && <>
                            {alertPersistentTaskNotifications.map((notification) => <NotificationItem key={`persistent:${notification.id}`} type="persistent-alert" data={notification} notificationKey={`persistent:${notification.id}`} openingNotificationKey={openingNotificationKey} onClick={() => void handlePersistentNotificationClick(notification)} dict={dict} locale={locale} />)}
                            {alertTaskNotifications.map((task) => {
                                const notificationKey = getTaskNotificationKey(task);
                                return <NotificationItem key={notificationKey} type={task.status === "rejected" ? "task-rejected" : "task-overdue"} data={task} notificationKey={notificationKey} openingNotificationKey={openingNotificationKey} onClick={() => void handleTaskNotificationClick(task)} dict={dict} locale={locale} locationName={getNotificationLocationName(task.location_id)} previewText={getNotificationPreview(task)} />;
                            })}
                            {secondaryReservationNotifications.map((reservation) => {
                                const notificationKey = getReservationNotificationKey(reservation);
                                return <NotificationItem key={notificationKey} type="reservation-cancelled" data={reservation} notificationKey={notificationKey} openingNotificationKey={openingNotificationKey} onClick={() => void handleReservationNotificationClick(reservation)} dict={dict} locale={locale} locationName={getNotificationLocationName(reservation.location_id)} />;
                            })}
                        </>}
                    </div>
                )}
            </div>
        </div>
    );
}
