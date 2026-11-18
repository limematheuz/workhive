"use client";

import { useCallback } from "react";
import { isCompanyTaskManagerRole } from "@/domain/access/roles";
import { ReservationService } from "@/services/reservation.service";
import { useNotificationSnapshot } from "./useNotificationSnapshot";

export function useReservationNotificationFeed(enabled: boolean, userId: number | undefined,
    companyId: number | undefined, roleName: string | undefined, onLoaded: (now: number) => void) {
    const context = enabled && userId && companyId && isCompanyTaskManagerRole(roleName) ? `${userId}:${companyId}:${roleName}` : null;
    const read = useCallback(async (readContext: string) => {
        const [reservations, arrivals] = await Promise.all([
            ReservationService.getReservations({}, `notification-reservations:${readContext}`),
            ReservationService.getUpcomingArrivals(3, `notification-reservations:${readContext}`),
        ]);
        return { reservations: [...reservations].sort((a, b) => new Date(b.updated_at || b.created_at).getTime() - new Date(a.updated_at || a.created_at).getTime()), arrivals };
    }, []);
    const feed = useNotificationSnapshot(context, read, onLoaded);
    return { notificationReservations: feed.value?.reservations ?? [], upcomingArrivals: feed.value?.arrivals ?? [],
        loadReservationNotifications: feed.load, reservationLoadFailed: feed.failed, reservationLoading: feed.loading };
}
