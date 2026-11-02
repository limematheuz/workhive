"use client";

import { startTransition, useEffect, useState } from "react";
import { NOTIFICATIONS_UPDATED_EVENT } from "@/components/dashboard/notifications/notification-utils";
import { TaskReportService, type TaskReport } from "@/services/task-report.service";

/** Owned by a keyed workspace: cleanup also prevents an old read acknowledging a new account. */
export function useTaskReportHistory(context: string, enabled: boolean) {
    const [reports, setReports] = useState<TaskReport[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);

    useEffect(() => {
        if (!enabled) return;
        const controller = new AbortController();
        let current = true;
        void TaskReportService.list({
            readContext: `${context}:${crypto.randomUUID()}`,
            signal: controller.signal,
        }).then(history => {
            if (!current) return;
            startTransition(() => { setReports(history); setLoading(false); });
            void TaskReportService.markNotificationsRead(controller.signal).then(() => {
                if (current) window.dispatchEvent(new Event(NOTIFICATIONS_UPDATED_EVENT));
            }).catch(() => {
                // Keep authorized history usable when alert acknowledgement fails.
            });
        }).catch(() => {
            if (current) startTransition(() => { setError(true); setLoading(false); });
        });
        return () => { current = false; controller.abort(); };
    }, [context, enabled]);

    return { reports, setReports, loading, error };
}
