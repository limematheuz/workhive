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
            const spaces = await LocationService.getSpaces(locationId);
            setZones(spaces.map((space) => ({
                id: space.id || 0,
                name: space.name,
                zone_type: space.space_type,
                sort_order: space.sort_order || 0,
                is_active: space.is_active !== false,
                tasks: space.tasks,
            })));
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
