"use client";

import { useCallback, useEffect, useState } from "react";

import { LocationService, type LocationZone } from "@/services/location.service";


export function useLocationZones(locationId: number | null, enabled: boolean) {
    const [zones, setZones] = useState<LocationZone[]>([]);
    const [loading, setLoading] = useState(false);
    const isEnabled = Boolean(locationId && enabled);

    const reload = useCallback(async () => {
        if (!locationId || !enabled) return;
        try {
            setLoading(true);
            setZones(await LocationService.getZones(locationId));
        } catch {
            setZones([]);
        } finally {
            setLoading(false);
        }
    }, [enabled, locationId]);

    useEffect(() => {
        if (!isEnabled) return;
        void Promise.resolve().then(reload);
    }, [isEnabled, reload]);

    return {
        zones: isEnabled ? zones : [],
        loading: isEnabled && loading,
        reload,
    };
}
