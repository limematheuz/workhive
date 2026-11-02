"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { isCompanyTaskManagerRole } from "@/domain/access/roles";
import { ReservationService } from "@/services/reservation.service";
import type { Reservation } from "@/types/reservation";

type Snapshot = { context: string; reservations: Reservation[]; arrivals: Reservation[] };

export function useReservationNotificationFeed(enabled: boolean, userId: number | undefined,
    companyId: number | undefined, roleName: string | undefined, onLoaded: (now: number) => void) {
    const context = enabled && userId && companyId && isCompanyTaskManagerRole(roleName) ? `${userId}:${companyId}:${roleName}` : null;
    const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
    const activeContext = useRef<string | null>(null);
    const version = useRef(0);
    const invalidateRequests = useCallback(() => { activeContext.current = null; version.current++; }, []);
    useEffect(() => {
        activeContext.current = context;
        return invalidateRequests;
    }, [context, invalidateRequests]);

    const loadReservationNotifications = useCallback(async () => {
        if (!context || activeContext.current !== context) return;
        const request = ++version.current;
        const readContext = `notification-reservations:${context}:${request}`;
        const [reservations, arrivals] = await Promise.all([
            ReservationService.getReservations({}, readContext).catch(() => [] as Reservation[]),
            ReservationService.getUpcomingArrivals(3, readContext).catch(() => [] as Reservation[]),
        ]);
        if (request === version.current && activeContext.current === context) {
            setSnapshot({ context, reservations: [...reservations].sort((a, b) => new Date(b.updated_at || b.created_at).getTime() - new Date(a.updated_at || a.created_at).getTime()), arrivals });
            onLoaded(Date.now());
        }
    }, [context, onLoaded]);

    const owned = context && snapshot?.context === context ? snapshot : null;
    return { notificationReservations: owned?.reservations ?? [], upcomingArrivals: owned?.arrivals ?? [], loadReservationNotifications };
}
