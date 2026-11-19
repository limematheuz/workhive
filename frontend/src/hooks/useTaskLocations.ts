"use client";

import { useCallback, useMemo, useState } from "react";
import { useResourceEffect } from "@/hooks/useResourceEffect";
import { LocationService, type Location } from "@/services/location.service";
import {
    readTaskLocationSnapshot, taskLocationIds, taskLocationsForScope,
    type TaskLocationReference, type TaskLocationSnapshot,
} from "@/lib/task-locations";

export function useTaskLocations(
    tasks: readonly TaskLocationReference[], master: Location[], authorizedRead: string | null,
) {
    const ids = useMemo(() => taskLocationIds(tasks), [tasks]);
    const scope = authorizedRead === null ? null : `${authorizedRead}|${ids.join(",")}`;
    const [snapshot, setSnapshot] = useState<TaskLocationSnapshot | null>(null);
    const request = useCallback(
        () => readTaskLocationSnapshot(scope ?? "denied", ids, master, id => LocationService.getLocation(id)),
        [ids, master, scope],
    );
    useResourceEffect(scope !== null, scope ?? "denied", request, setSnapshot, () => setSnapshot(null));
    return useMemo(() => taskLocationsForScope(snapshot, scope, master, ids), [snapshot, scope, master, ids]);
}
