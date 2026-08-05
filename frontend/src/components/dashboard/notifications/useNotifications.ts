"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { TaskItem, TaskService } from "@/services/task.service";
import { Location, LocationService } from "@/services/location.service";
import { CollaborationService } from "@/services/collaboration.service";
import { ReservationService } from "@/services/reservation.service";
import { PrivacyRequest, PrivacyService } from "@/services/privacy.service";
import { CompanyCollaboration } from "@/types/collaboration";
import { Reservation } from "@/types/reservation";
import { useBackgroundPolling } from "@/hooks/useBackgroundPolling";
import { POLL_INTERVALS } from "@/lib/polling";
import { getUserTaskStatus, getUserChecklistItems, parseInstructionContent } from "@/lib/format";
import {
    getDismissedNotificationKeys,
    persistDismissedNotificationKeys,
    getTaskNotificationKey,
    getCollaborationNotificationKey,
    getReservationNotificationKey,
    getUpcomingArrivalNotificationKey,
    getPrivacyRequestNotificationKey,
    isWithinLastDays,
    NOTIFICATIONS_UPDATED_EVENT,
    NotificationTab,
} from "./notification-utils";
import { acknowledgeTaskOpened } from "./task-notification-acknowledgement";
import type { Dictionary } from "@/lib/dictionary-context";
import {
    isCompanyAdminRole,
    isCompanyTaskManagerRole,
} from "@/domain/access/roles";
import { NotificationService, PersistentNotification } from "@/services/notification.service";
import {
    getPersistentNotificationHref,
    getPersistentTaskNotificationIds,
} from "@/lib/task-reporting";
import { getTaskScheduleDate, isTaskOverdue } from "@/domain/tasks/task-schedule";
import { isOperationalStatus } from "@/domain/tasks/task-status";
import { getTaskNotificationPriority } from "@/lib/notification-priority";

const ACTIVE_PRIVACY_REQUEST_STATUSES = new Set(["pending", "processing"]);

interface UseNotificationsParams {
    enabled?: boolean;
    userId: number | undefined;
    companyId: number | undefined;
    roleName: string | undefined;
    dict: Dictionary;
    setIsNotificationsOpen: (open: boolean) => void;
}

export function useNotifications({
    enabled = true,
    userId,
    companyId,
    roleName,
    dict,
    setIsNotificationsOpen,
}: UseNotificationsParams) {
    const router = useRouter();
    const [notificationTasks, setNotificationTasks] = useState<TaskItem[]>([]);
    const [notificationLocations, setNotificationLocations] = useState<Location[]>([]);
    const [notificationCollabs, setNotificationCollabs] = useState<CompanyCollaboration[]>([]);
    const [notificationReservations, setNotificationReservations] = useState<Reservation[]>([]);
    const [privacyRequests, setPrivacyRequests] = useState<PrivacyRequest[]>([]);
    const [upcomingArrivals, setUpcomingArrivals] = useState<Reservation[]>([]);
    const [notificationReferenceTime, setNotificationReferenceTime] = useState(0);
    const [dismissedNotificationKeys, setDismissedNotificationKeys] = useState<string[]>([]);
    const [openingNotificationKey, setOpeningNotificationKey] = useState<string | null>(null);
    const [persistentNotifications, setPersistentNotifications] = useState<PersistentNotification[]>([]);
    const pendingTaskAcknowledgementsRef = useRef(new Set<number>());

    const loadNotifications = useCallback(async () => {
        if (!enabled || !userId) return;

        const isManagerOrAdmin = isCompanyTaskManagerRole(roleName);
        const canReadCompanyPrivacy = isCompanyAdminRole(roleName);

        const [tasks, requestedTasks, rejectedTasks, locations, collabs, reservations, arrivals, privacy, persistent] = await Promise.all([
            TaskService.getTaskItems({ userId }).catch(() => [] as TaskItem[]),
            isManagerOrAdmin
                ? TaskService.getTaskItems({ status: "requested" }).catch(() => [] as TaskItem[])
                : Promise.resolve([] as TaskItem[]),
            isManagerOrAdmin
                ? TaskService.getTaskItems({ status: "rejected" }).catch(() => [] as TaskItem[])
                : Promise.resolve([] as TaskItem[]),
            LocationService.getLocations().catch(() => [] as Location[]),
            isManagerOrAdmin
                ? CollaborationService.getPendingRequests().catch(() => [] as CompanyCollaboration[])
                : Promise.resolve([] as CompanyCollaboration[]),
            isManagerOrAdmin
                ? ReservationService.getReservations().catch(() => [] as Reservation[])
                : Promise.resolve([] as Reservation[]),
            isManagerOrAdmin
                ? ReservationService.getUpcomingArrivals(3).catch(() => [] as Reservation[])
                : Promise.resolve([] as Reservation[]),
            canReadCompanyPrivacy
                ? PrivacyService.listCompanyRequests().catch(() => [] as PrivacyRequest[])
                : Promise.resolve([] as PrivacyRequest[]),
            NotificationService.listUnread().catch(() => [] as PersistentNotification[]),
        ]);

        const mergedTasksMap = new Map<number, TaskItem>();
        tasks.forEach(t => mergedTasksMap.set(t.id, t));
        requestedTasks.forEach(t => mergedTasksMap.set(t.id, t));
        rejectedTasks.forEach(t => mergedTasksMap.set(t.id, t));

        setNotificationTasks(
            Array.from(mergedTasksMap.values()).sort(
                (a, b) => new Date(b.updated_at || b.created_at).getTime() - new Date(a.updated_at || a.created_at).getTime()
            )
        );
        setNotificationLocations(locations);
        setNotificationCollabs(
            [...collabs].sort(
                (a, b) => new Date(b.updated_at || b.created_at).getTime() - new Date(a.updated_at || a.created_at).getTime()
            )
        );
        setNotificationReservations(
            [...reservations].sort(
                (a, b) => new Date(b.updated_at || b.created_at).getTime() - new Date(a.updated_at || a.created_at).getTime()
            )
        );
        setUpcomingArrivals(arrivals);
        setPrivacyRequests(privacy);
        setPersistentNotifications(persistent.filter((notification) => !(
            notification.entity_type === "task_item"
            && typeof notification.entity_id === "number"
            && pendingTaskAcknowledgementsRef.current.has(notification.entity_id)
        )));
        setNotificationReferenceTime(Date.now());
    }, [enabled, userId, roleName]);

    useEffect(() => {
        if (!enabled || !userId) return;
        const timeoutId = window.setTimeout(() => {
            void loadNotifications();
        }, 0);
        return () => window.clearTimeout(timeoutId);
    }, [enabled, userId, loadNotifications]);

    useBackgroundPolling(
        enabled ? loadNotifications : () => undefined,
        POLL_INTERVALS.notifications,
    );

    useEffect(() => {
        if (!userId) return;
        const syncDismissedNotifications = () => {
            setDismissedNotificationKeys(getDismissedNotificationKeys(userId));
        };
        const refreshNotifications = (event: Event) => {
            const detail = (event as CustomEvent<{ userId?: number; taskItemId?: number; serverConfirmed?: boolean }>).detail;
            if (detail?.userId && detail.userId !== userId) return;
            syncDismissedNotifications();
            if (typeof detail?.taskItemId === "number") {
                pendingTaskAcknowledgementsRef.current.add(detail.taskItemId);
                setPersistentNotifications((items) => items.filter((notification) => (
                    notification.entity_type !== "task_item"
                    || notification.entity_id !== detail.taskItemId
                )));
                if (detail.serverConfirmed) {
                    pendingTaskAcknowledgementsRef.current.delete(detail.taskItemId);
                    void loadNotifications();
                }
                return;
            }
            void loadNotifications();
        };

        syncDismissedNotifications();
        window.addEventListener("storage", syncDismissedNotifications);
        window.addEventListener(NOTIFICATIONS_UPDATED_EVENT, refreshNotifications);
        return () => {
            window.removeEventListener("storage", syncDismissedNotifications);
            window.removeEventListener(NOTIFICATIONS_UPDATED_EVENT, refreshNotifications);
        };
    }, [loadNotifications, userId]);

    const dismissedNotificationKeySet = useMemo(
        () => new Set(dismissedNotificationKeys),
        [dismissedNotificationKeys]
    );
    const persistentTaskNotificationIds = useMemo(
        () => getPersistentTaskNotificationIds(persistentNotifications),
        [persistentNotifications],
    );

    const tasksById = useMemo(
        () => new Map(notificationTasks.map((task) => [task.id, task])),
        [notificationTasks],
    );

    const isAlertTask = useCallback((task: TaskItem | undefined) => (
        Boolean(task && getTaskNotificationPriority(
            task.status,
            isOperationalStatus(task.status) && task.status !== "completed" && isTaskOverdue(task),
        ) === "alert")
    ), []);

    const primaryPersistentNotifications = useMemo(() => persistentNotifications.filter((notification) => {
        if (notification.entity_type !== "task_item") return true;
        return !isAlertTask(
            typeof notification.entity_id === "number"
                ? tasksById.get(notification.entity_id)
                : undefined,
        );
    }), [isAlertTask, persistentNotifications, tasksById]);

    const alertPersistentTaskNotifications = useMemo(() => persistentNotifications.filter((notification) => (
        notification.entity_type === "task_item"
        && typeof notification.entity_id === "number"
        && isAlertTask(tasksById.get(notification.entity_id))
    )), [isAlertTask, persistentNotifications, tasksById]);

    const taskNotifications = useMemo(() => {
        if (!userId) return [];
        return notificationTasks.filter(task => {
            if (persistentTaskNotificationIds.has(task.id)) return false;
            const status = getUserTaskStatus(task, userId);
            if (task.status === "rejected" && companyId) {
                const ownerCompanyId = task.checkout_reservation?.owner_company_id;
                if (ownerCompanyId !== undefined && ownerCompanyId !== companyId) {
                    return false;
                }
                if (ownerCompanyId === undefined && task.user_company_id === companyId) {
                    return false;
                }
            }
            const isAlert = isAlertTask(task);
            return (
                task.status === "rejected"
                || status === "pending"
                || status === "requested"
                || isAlert
            ) && !dismissedNotificationKeySet.has(getTaskNotificationKey(task));
        });
    }, [
        notificationTasks,
        userId,
        companyId,
        dismissedNotificationKeySet,
        persistentTaskNotificationIds,
        isAlertTask,
    ]);

    const primaryTaskNotifications = useMemo(() => taskNotifications.filter((task) => (
        getTaskNotificationPriority(
            task.status,
            isOperationalStatus(task.status) && task.status !== "completed" && isTaskOverdue(task),
        ) === "update"
    )), [taskNotifications]);
    const alertTaskNotifications = useMemo(() => taskNotifications.filter((task) => (
        getTaskNotificationPriority(
            task.status,
            isOperationalStatus(task.status) && task.status !== "completed" && isTaskOverdue(task),
        ) === "alert"
    )), [taskNotifications]);

    const taskLinkedReservationIds = useMemo(() => new Set(
        primaryTaskNotifications.flatMap((task) => [
            task.checkout_reservation?.id,
            task.next_reservation?.id,
        ].filter((id): id is number => typeof id === "number"))
    ), [primaryTaskNotifications]);

    const primaryCollaborationNotifications = useMemo(() => notificationCollabs.filter(
        collaboration => !dismissedNotificationKeySet.has(getCollaborationNotificationKey(collaboration))
    ), [notificationCollabs, dismissedNotificationKeySet]);

    const secondaryReservationNotifications = useMemo(() => notificationReservations.filter(reservation => (
        reservation.owner_company_id === companyId
        && reservation.status === "cancelled"
        && reservation.updated_by_user_id !== userId
        && isWithinLastDays(reservation.updated_at, 30, notificationReferenceTime)
        && !dismissedNotificationKeySet.has(getReservationNotificationKey(reservation))
    )), [notificationReservations, companyId, userId, notificationReferenceTime, dismissedNotificationKeySet]);

    const upcomingArrivalNotifications = useMemo(() => upcomingArrivals.filter(reservation => (
        !taskLinkedReservationIds.has(reservation.id)
        && !dismissedNotificationKeySet.has(getUpcomingArrivalNotificationKey(reservation))
    )), [upcomingArrivals, taskLinkedReservationIds, dismissedNotificationKeySet]);

    const privacyRequestNotifications = useMemo(() => privacyRequests.filter(request => (
        request.request_type === "erasure"
        && ACTIVE_PRIVACY_REQUEST_STATUSES.has(request.status)
        && !dismissedNotificationKeySet.has(getPrivacyRequestNotificationKey(request))
    )), [privacyRequests, dismissedNotificationKeySet]);

    const primaryNotificationCount = primaryPersistentNotifications.length
        + primaryTaskNotifications.length
        + primaryCollaborationNotifications.length
        + upcomingArrivalNotifications.length
        + privacyRequestNotifications.length;

    const alertNotificationCount = alertPersistentTaskNotifications.length
        + alertTaskNotifications.length
        + secondaryReservationNotifications.length;

    const totalNotificationCount = primaryNotificationCount + alertNotificationCount;
    const hasAlertNotifications = alertNotificationCount > 0;

    const getNotificationLocationName = useCallback((locationId: number) => {
        return notificationLocations.find(location => location.id === locationId)?.name || `Ubicación #${locationId}`;
    }, [notificationLocations]);

    const getNotificationPreview = useCallback((task: TaskItem) => {
        if (!userId) return "";
        if (task.status === "rejected") {
            return dict.notifications?.messages?.rejected_task_desc || "El colaborador ha rechazado esta solicitud de limpieza.";
        }
        const userItems = getUserChecklistItems(task, userId);
        if (userItems.length > 0) return userItems.map(item => item.text).join(" • ");
        const content = parseInstructionContent(task.description);
        if (content.items.length > 0) return content.items.join(" • ");
        return content.summary || task.title;
    }, [userId, dict.notifications]);

    const dismissNotifications = useCallback((keys: string[]) => {
        if (!userId) return;
        const nextDismissedKeys = Array.from(new Set([...dismissedNotificationKeys, ...keys]));
        setDismissedNotificationKeys(nextDismissedKeys);
        persistDismissedNotificationKeys(userId, nextDismissedKeys);
    }, [userId, dismissedNotificationKeys]);

    const acknowledgePersistentNotifications = useCallback((notifications: PersistentNotification[]) => {
        if (!notifications.length) return;

        const taskItemIds = new Set(
            notifications.flatMap((notification) => (
                notification.entity_type === "task_item" && typeof notification.entity_id === "number"
                    ? [notification.entity_id]
                    : []
            )),
        );
        const notificationIds = new Set(notifications.map((notification) => notification.id));

        taskItemIds.forEach((taskItemId) => pendingTaskAcknowledgementsRef.current.add(taskItemId));
        setPersistentNotifications((items) => items.filter((notification) => (
            !notificationIds.has(notification.id)
            && !(notification.entity_type === "task_item"
                && typeof notification.entity_id === "number"
                && taskItemIds.has(notification.entity_id))
        )));

        void Promise.all([
            ...Array.from(taskItemIds, (taskItemId) => NotificationService.markTaskItemRead(taskItemId)),
            ...notifications
                .filter((notification) => notification.entity_type !== "task_item")
                .map((notification) => NotificationService.markRead(notification.id)),
        ]).catch(() => {
            // Refresh below restores the authoritative server state on failure.
        }).finally(() => {
            taskItemIds.forEach((taskItemId) => pendingTaskAcknowledgementsRef.current.delete(taskItemId));
            void loadNotifications();
        });
    }, [loadNotifications]);

    const handleClearActiveTab = useCallback((activeNotificationTab: NotificationTab) => {
        const relatedArrivalKeys = primaryTaskNotifications.flatMap((task) =>
            upcomingArrivals.flatMap((reservation) => (
                reservation.id === task.checkout_reservation?.id
                || reservation.id === task.next_reservation?.id
            )
                ? [getUpcomingArrivalNotificationKey(reservation)]
                : [])
        );
        const keys = activeNotificationTab === "primary"
            ? [
                ...primaryTaskNotifications.map(getTaskNotificationKey),
                ...relatedArrivalKeys,
                ...primaryCollaborationNotifications.map(getCollaborationNotificationKey),
                ...upcomingArrivalNotifications.map(getUpcomingArrivalNotificationKey),
                ...privacyRequestNotifications.map(getPrivacyRequestNotificationKey),
            ]
            : [
                ...alertTaskNotifications.map(getTaskNotificationKey),
                ...secondaryReservationNotifications.map(getReservationNotificationKey),
            ];

        dismissNotifications(keys);
        acknowledgePersistentNotifications(
            activeNotificationTab === "primary"
                ? primaryPersistentNotifications
                : alertPersistentTaskNotifications,
        );
    }, [
        primaryTaskNotifications,
        upcomingArrivals,
        primaryCollaborationNotifications,
        upcomingArrivalNotifications,
        privacyRequestNotifications,
        alertTaskNotifications,
        secondaryReservationNotifications,
        dismissNotifications,
        primaryPersistentNotifications,
        alertPersistentTaskNotifications,
        acknowledgePersistentNotifications,
    ]);

    const handlePersistentNotificationClick = useCallback((notification: PersistentNotification) => {
        const key = `persistent:${notification.id}`;
        setOpeningNotificationKey(key);
        if (notification.entity_type === "task_item" && typeof notification.entity_id === "number") {
            const taskItemId = notification.entity_id;
            pendingTaskAcknowledgementsRef.current.add(taskItemId);
            setPersistentNotifications((items) => items.filter((item) => (
                item.entity_type !== "task_item" || item.entity_id !== taskItemId
            )));
            void NotificationService.markTaskItemRead(taskItemId).then(
                () => {
                    if (typeof window !== "undefined") {
                        window.dispatchEvent(new CustomEvent(NOTIFICATIONS_UPDATED_EVENT, {
                            detail: { userId, taskItemId, serverConfirmed: true },
                        }));
                    }
                },
                () => {
                    pendingTaskAcknowledgementsRef.current.delete(taskItemId);
                    void loadNotifications();
                },
            );
        } else {
            setPersistentNotifications((items) => items.filter((item) => item.id !== notification.id));
            void NotificationService.markRead(notification.id).catch(() => {
                void loadNotifications();
            });
        }
        setIsNotificationsOpen(false);
        router.push(getPersistentNotificationHref(notification));
        setOpeningNotificationKey(null);
    }, [loadNotifications, router, setIsNotificationsOpen, userId]);

    const getNotificationHref = useCallback((task: TaskItem) => {
        if (task.status === "requested") {
            return `/dashboard/reservations?tab=requests&taskId=${task.id}`;
        }
        if (task.status === "rejected") {
            return `/dashboard/reservations`;
        }
        const params = new URLSearchParams({
            taskId: task.id.toString(),
            taskDate: (getTaskScheduleDate(task) || new Date(task.created_at)).toISOString(),
        });
        return `/dashboard?${params.toString()}`;
    }, []);

    const handleTaskNotificationClick = useCallback(async (task: TaskItem) => {
        if (!userId) return;
        const notificationKey = getTaskNotificationKey(task);
        const relatedArrivalKeys = upcomingArrivals.flatMap((reservation) => (
            reservation.id === task.checkout_reservation?.id
            || reservation.id === task.next_reservation?.id
        )
            ? [getUpcomingArrivalNotificationKey(reservation)]
            : []);
        setOpeningNotificationKey(notificationKey);

        try {
            const currentTask = await TaskService.getTaskItem(task.id);
            acknowledgeTaskOpened(userId, currentTask);
            dismissNotifications([...relatedArrivalKeys]);
            setIsNotificationsOpen(false);
            router.push(getNotificationHref(currentTask));
        } catch {
            void loadNotifications();
        } finally {
            setOpeningNotificationKey(null);
        }
    }, [upcomingArrivals, dismissNotifications, getNotificationHref, loadNotifications, setIsNotificationsOpen, router, userId]);

    const handleCollaborationNotificationClick = useCallback(async (collaboration: CompanyCollaboration) => {
        const notificationKey = getCollaborationNotificationKey(collaboration);
        setOpeningNotificationKey(notificationKey);

        try {
            const currentRequests = await CollaborationService.getPendingRequests();
            dismissNotifications([notificationKey]);
            if (currentRequests.some(request => request.id === collaboration.id)) {
                setIsNotificationsOpen(false);
                router.push("/dashboard/collaborations");
            }
        } catch {
            dismissNotifications([notificationKey]);
        } finally {
            setOpeningNotificationKey(null);
        }
    }, [dismissNotifications, setIsNotificationsOpen, router]);

    const handleReservationNotificationClick = useCallback(async (reservation: Reservation) => {
        const notificationKey = getReservationNotificationKey(reservation);
        setOpeningNotificationKey(notificationKey);

        try {
            const currentReservation = await ReservationService.getReservation(reservation.id);
            dismissNotifications([notificationKey]);
            setIsNotificationsOpen(false);
            router.push(`/dashboard/reservations?reservationId=${currentReservation.id}`);
        } catch {
            dismissNotifications([notificationKey]);
        } finally {
            setOpeningNotificationKey(null);
        }
    }, [dismissNotifications, setIsNotificationsOpen, router]);

    const handleUpcomingArrivalClick = useCallback(async (reservation: Reservation) => {
        const notificationKey = getUpcomingArrivalNotificationKey(reservation);
        setOpeningNotificationKey(notificationKey);
        try {
            await ReservationService.getReservation(reservation.id);
            dismissNotifications([notificationKey]);
            setIsNotificationsOpen(false);
            router.push(`/dashboard/reservations?reservationId=${reservation.id}`);
        } catch {
            dismissNotifications([notificationKey]);
        } finally {
            setOpeningNotificationKey(null);
        }
    }, [dismissNotifications, setIsNotificationsOpen, router]);

    const handlePrivacyRequestClick = useCallback((request: PrivacyRequest) => {
        dismissNotifications([getPrivacyRequestNotificationKey(request)]);
        setIsNotificationsOpen(false);
        router.push("/dashboard/profile");
    }, [dismissNotifications, setIsNotificationsOpen, router]);

    return {
        loadNotifications,
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
        hasAlertNotifications,
        openingNotificationKey,
        notificationReferenceTime,
        getNotificationLocationName,
        getNotificationPreview,
        handleClearActiveTab,
        handleTaskNotificationClick,
        handleCollaborationNotificationClick,
        handleReservationNotificationClick,
        handleUpcomingArrivalClick,
        handlePrivacyRequestClick,
        handlePersistentNotificationClick,
        upcomingArrivals,
    };
}
