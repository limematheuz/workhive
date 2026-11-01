"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { LocationService, type Location } from "@/services/location.service";
import { OrganizationService } from "@/services/organization.service";

// Location metadata has its own permission boundary. Notification delivery does
// not depend on it, and a failed or revoked lookup must not retain old names.
export function useNotificationLocations(enabled: boolean, userId: number | undefined, companyId: number | undefined) {
    const context = enabled && userId && companyId ? `${userId}:${companyId}` : null;
    const [snapshot, setSnapshot] = useState<{ context: string | null; locations: Location[] }>({ context: null, locations: [] });
    const requestVersion = useRef(0);

    useEffect(() => () => { requestVersion.current++; }, [context]);

    const loadLocationNotifications = useCallback(async () => {
        if (!context) return;
        const version = ++requestVersion.current;
        let locations: Location[] = [];
        try {
            const access = await OrganizationService.getAccess();
            if (version !== requestVersion.current) return;
            if (access["locations.read"] === true) locations = await LocationService.getLocations();
        } catch {
            // Keep other notification feeds available; fail closed for names.
        }
        if (version === requestVersion.current) setSnapshot({ context, locations });
    }, [context]);

    const names = useMemo(() => new Map(
        context && snapshot.context === context ? snapshot.locations.map(location => [location.id, location.name]) : [],
    ), [context, snapshot]);
    const getNotificationLocationName = useCallback((locationId: number) => names.get(locationId) || `Ubicación #${locationId}`, [names]);

    return { loadLocationNotifications, getNotificationLocationName };
}
