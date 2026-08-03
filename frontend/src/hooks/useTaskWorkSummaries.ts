"use client";

import { useEffect, useMemo, useState } from "react";
import { WorkSessionService } from "@/services/work-session.service";
import { TaskItem, TaskWorkDetailedSummary } from "@/types/user";

const EMPTY_SUMMARIES: Record<number, TaskWorkDetailedSummary> = {};

export function useTaskWorkSummaries(tasks: TaskItem[]) {
    const taskIdsKey = useMemo(() => tasks.map((task) => task.id).join(","), [tasks]);
    const taskIds = useMemo(
        () => taskIdsKey ? taskIdsKey.split(",").map(Number) : [],
        [taskIdsKey],
    );
    const [summaries, setSummaries] = useState<Record<number, TaskWorkDetailedSummary>>({});

    useEffect(() => {
        let cancelled = false;
        if (!taskIdsKey) {
            return () => { cancelled = true; };
        }

        WorkSessionService.getTaskDetailedSummaries(taskIds)
            .then((items) => {
                if (cancelled) return;
                setSummaries(Object.fromEntries(items.map((item) => [item.task_item_id, item])));
            })
            .catch(() => {
                if (!cancelled) setSummaries({});
            });

        return () => { cancelled = true; };
    }, [taskIds, taskIdsKey]);

    return taskIdsKey ? summaries : EMPTY_SUMMARIES;
}
