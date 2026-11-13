"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ApiResponseError } from "@/lib/api";
import { LocationService, type Location } from "@/services/location.service";
import { TaskService, type TaskItem } from "@/services/task.service";

type ClientFilter = number | "ALL";
type ReadError = "locations" | "denied" | "tasks" | null;
interface ListState {
    filter: ClientFilter;
    locations: Location[];
    tasks: TaskItem[] | null;
    loaded: boolean;
    loading: boolean;
    error: ReadError;
}

const initialState = (filter: ClientFilter): ListState => ({ filter, locations: [], tasks: null, loaded: false, loading: true, error: null });

export function useLocationList(clientFilter: ClientFilter) {
    const [state, setState] = useState(() => initialState(clientFilter));
    const request = useRef({ generation: 0 });
    const reload = useCallback(async () => {
        const generation = ++request.current.generation;
        setState(current => current.filter === clientFilter
            ? { ...current, loading: true, error: null }
            : initialState(clientFilter));
        try {
            const locations = await LocationService.getLocations(clientFilter === "ALL" ? undefined : clientFilter);
            if (request.current.generation !== generation) return;
            let tasks: TaskItem[] | null = null;
            try { tasks = await TaskService.getTaskItems(); } catch { /* Counts stay unknown when task reading fails. */ }
            if (request.current.generation !== generation) return;
            setState({ filter: clientFilter, locations, tasks, loaded: true, loading: false, error: tasks === null ? "tasks" : null });
        } catch (error) {
            if (request.current.generation !== generation) return;
            const denied = error instanceof ApiResponseError && [401, 403, 404].includes(error.status);
            setState(current => ({
                ...(!denied && current.filter === clientFilter ? current : initialState(clientFilter)),
                loading: false,
                error: denied ? "denied" : "locations",
            }));
        }
    }, [clientFilter]);

    useEffect(() => {
        const pendingRequest = request.current;
        const timer = window.setTimeout(() => void reload(), 0);
        return () => { window.clearTimeout(timer); pendingRequest.generation++; };
    }, [reload]);

    return { ...(state.filter === clientFilter ? state : initialState(clientFilter)), reload };
}
