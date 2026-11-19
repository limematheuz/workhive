"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import type { TaskItem } from "@/types/user";
import { acknowledgeTaskOpened } from "../notifications/task-notification-acknowledgement";

const HISTORY_KEY = "operationsOverviewTask";

export function useOverviewTaskSelection(tasks: TaskItem[], userId: number) {
    const params = useSearchParams();
    const queryId = Number(params.get("taskId"));
    const [selectedId, setSelectedId] = useState<number | null>(null);
    const acknowledged = useRef<number | null>(null);
    const historyOpen = useRef(false);
    const open = useCallback((task: TaskItem) => {
        acknowledgeTaskOpened(userId, task);
        setSelectedId(task.id);
        if (!historyOpen.current) {
            window.history.pushState({ [HISTORY_KEY]: task.id }, "");
            historyOpen.current = true;
        }
    }, [userId]);
    const close = useCallback(() => {
        setSelectedId(null);
        if (historyOpen.current && window.history.state?.[HISTORY_KEY]) {
            historyOpen.current = false;
            window.history.back();
        }
    }, []);
    useEffect(() => {
        const task = tasks.find(item => item.id === queryId);
        if (!task || acknowledged.current === queryId) return;
        const timer = window.setTimeout(() => {
            acknowledged.current = queryId;
            acknowledgeTaskOpened(userId, task);
            setSelectedId(task.id);
        }, 0);
        return () => window.clearTimeout(timer);
    }, [queryId, tasks, userId]);
    useEffect(() => {
        const onBack = () => { historyOpen.current = false; setSelectedId(null); };
        window.addEventListener("popstate", onBack);
        return () => window.removeEventListener("popstate", onBack);
    }, []);
    return { selected: tasks.find(task => task.id === selectedId) || null, open, close };
}
