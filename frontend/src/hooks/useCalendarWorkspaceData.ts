"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { canManageCompanyTasks, isSuperadmin } from "@/domain/access/roles";
import { classifyReadError, type ReadErrorKind } from "@/lib/read-recovery";
import { LocationService, type Location } from "@/services/location.service";
import { TaskService, type TaskItem } from "@/services/task.service";
import { UserService } from "@/services/user.service";
import type { User } from "@/types/user";

type Snapshot = { tasks: TaskItem[]; locations: Location[]; users: User[]; confirmed: boolean; loading: boolean; error: ReadErrorKind | null };
const emptySnapshot = (): Snapshot => ({ tasks: [], locations: [], users: [], confirmed: false, loading: true, error: null });

/** Mounted inside a workspace keyed by the authenticated identity and company. */
export function useCalendarWorkspaceData(user: User) {
    const [snapshot, setSnapshot] = useState<Snapshot>(emptySnapshot);
    const request = useRef({ version: 0 });
    useEffect(() => {
        const pending = request.current;
        return () => { pending.version++; };
    }, []);

    const reload = useCallback(async () => {
        const version = ++request.current.version;
        const readContext = `calendar:${user.id}:${user.company_id}:${user.role?.name}:${version}`;
        setSnapshot(current => ({ ...current, loading: true }));
        try {
            const [tasks, locations, users] = await Promise.all([
                TaskService.getAllTaskItems({}, readContext),
                LocationService.getLocations(undefined, readContext),
                canManageCompanyTasks(user) ? UserService.getAssignableUsers(undefined, undefined, undefined, readContext) : Promise.resolve([user]),
            ]);
            if (version !== request.current.version) return;
            setSnapshot({ tasks, locations, users: users.filter(item => !isSuperadmin(item)), confirmed: true, loading: false, error: null });
        } catch (error) {
            if (version !== request.current.version) return;
            const kind = classifyReadError(error);
            setSnapshot(current => ({ ...(kind === "denied" ? emptySnapshot() : current), loading: false, error: kind }));
        }
    }, [user]);

    return { ...snapshot, reload };
}
