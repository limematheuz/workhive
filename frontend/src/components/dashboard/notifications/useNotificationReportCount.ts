"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ApiResponseError } from "@/lib/api";
import { countUnreadTaskReportNotifications } from "@/lib/task-reporting";
import { NotificationService } from "@/services/notification.service";

type CountSnapshot = { context: string; count: number };

export function useNotificationReportCount(enabled: boolean, userId: number | undefined, companyId: number | null | undefined) {
    const context = enabled && userId && companyId ? `${userId}:${companyId}` : null;
    const [snapshot, setSnapshot] = useState<CountSnapshot | null>(null);
    const activeContext = useRef<string | null>(null);
    const version = useRef(0);
    const invalidateRequests = useCallback(() => { activeContext.current = null; version.current++; }, []);

    useEffect(() => {
        activeContext.current = context;
        return invalidateRequests;
    }, [context, invalidateRequests]);

    const refreshReports = useCallback(async () => {
        if (!context || activeContext.current !== context) return;
        const request = ++version.current;
        try {
            const notifications = await NotificationService.listUnread(`reports:${context}:${request}`);
            if (request === version.current && activeContext.current === context) {
                setSnapshot({ context, count: countUnreadTaskReportNotifications(notifications) });
            }
        } catch (error) {
            const transient = !(error instanceof ApiResponseError) || error.status >= 500 || error.status === 408 || error.status === 429;
            if (!transient && request === version.current && activeContext.current === context) {
                setSnapshot({ context, count: 0 });
            }
        }
    }, [context]);

    return { reportAlertsCount: context && snapshot?.context === context ? snapshot.count : 0, refreshReports };
}
