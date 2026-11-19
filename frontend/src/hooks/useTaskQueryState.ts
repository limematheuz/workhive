"use client";
import { useCallback, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { useViewState } from "./useViewState";
import { taskViewFilter } from "@/domain/tasks/task-view-filters";

/** Validated filters survive details, reloads and links shared with another authorized user. */
export function useTaskQueryState(name: string, initial = "") {
    const params = useSearchParams(), raw = params.get(name);
    const [stored, write] = useViewState(`tasks.${name}`, initial);
    const value = taskViewFilter(name, raw ?? stored);
    useEffect(() => { if (raw !== null) { const timer = window.setTimeout(() => write(taskViewFilter(name, raw)), 0); return () => window.clearTimeout(timer); } }, [name, raw, write]);
    const set = useCallback((next: string) => {
        const validated = taskViewFilter(name, next);
        write(validated);
        const target = new URL(window.location.href);
        if (validated) target.searchParams.set(name, validated); else target.searchParams.delete(name);
        window.history.replaceState(null, "", target.pathname + target.search + target.hash);
    }, [name, write]);
    return [value, set] as const;
}
