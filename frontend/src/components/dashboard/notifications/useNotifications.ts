"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
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
import { getTaskScheduleDate } from "@/domain/tasks/task-schedule";

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
        setPersistentNotifications(persistent);
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
        const refreshNotifications = () => {
            syncDismissedNotifications();
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
            return (
                task.status === "rejected"
                || status === "pending"
                || status === "requested"
            ) && !dismissedNotificationKeySet.has(getTaskNotificationKey(task));
        });
    }, [
        notificationTasks,
        userId,
        companyId,
        dismissedNotificationKeySet,
        persistentTaskNotificationIds,
    ]);

    const primaryTaskNotifications = useMemo(() => taskNotifications.filter(task => task.status !== "rejected"), [taskNotifications]);
    const secondaryTaskNotifications = useMemo(() => taskNotifications.filter(task => task.status === "rejected"), [taskNotifications]);

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

    const primaryNotificationCount = persistentNotifications.length
        + primaryTaskNotifications.length
        + primaryCollaborationNotifications.length
        + upcomingArrivalNotifications.length
        + privacyRequestNotifications.length;

    const secondaryNotificationCount = secondaryTaskNotifications.length
        + secondaryReservationNotifications.length;

    const totalNotificationCount = primaryNotificationCount + secondaryNotificationCount;

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
                ...secondaryTaskNotifications.map(getTaskNotificationKey),
                ...secondaryReservationNotifications.map(getReservationNotificationKey),
            ];

        dismissNotifications(keys);
        if (activeNotificationTab === "primary" && persistentNotifications.length) {
            void NotificationService.markAllRead().then(() => setPersistentNotifications([]));
        }
    }, [
        primaryTaskNotifications,
        upcomingArrivals,
        primaryCollaborationNotifications,
        upcomingArrivalNotifications,
        privacyRequestNotifications,
        secondaryTaskNotifications,
        secondaryReservationNotifications,
        dismissNotifications,
        persistentNotifications,
    ]);

    const handlePersistentNotificationClick = useCallback(async (notification: PersistentNotification) => {
        const key = `persistent:${notification.id}`;
        setOpeningNotificationKey(key);
        try {
            await NotificationService.markRead(notification.id);
            setPersistentNotifications((items) => items.filter((item) => item.id !== notification.id));
            setIsNotificationsOpen(false);
            router.push(getPersistentNotificationHref(notification));
        } finally {
            setOpeningNotificationKey(null);
        }
    }, [router, setIsNotificationsOpen]);

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
            dismissNotifications([notificationKey, ...relatedArrivalKeys]);
            setIsNotificationsOpen(false);
            router.push(getNotificationHref(currentTask));
        } catch {
            void loadNotifications();
        } finally {
            setOpeningNotificationKey(null);
        }
    }, [upcomingArrivals, dismissNotifications, getNotificationHref, loadNotifications, setIsNotificationsOpen, router]);

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
        handleReservationNotificationClick,
        handleUpcomingArrivalClick,
        handlePrivacyRequestClick,
        handlePersistentNotificationClick,
        upcomingArrivals,
    };
}
