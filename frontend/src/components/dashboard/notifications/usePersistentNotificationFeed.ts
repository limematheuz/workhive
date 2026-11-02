"use client";

import { useCallback, useEffect, useRef, useState, type SetStateAction } from "react";
import { ApiResponseError } from "@/lib/api";
import { NotificationService, type PersistentNotification } from "@/services/notification.service";

type Snapshot = {
    context: string | null;
    items: PersistentNotification[];
    loading: boolean;
    failed: boolean;
};

export function usePersistentNotificationFeed(enabled: boolean, userId: number | undefined,
    companyId: number | undefined, pendingAcknowledgements: Set<number>) {
    const context = enabled && userId && companyId ? `${userId}:${companyId}` : null;
    const [snapshot, setSnapshot] = useState<Snapshot>({ context: null, items: [], loading: false, failed: false });
    const activeContext = useRef<string | null>(null);
    const version = useRef(0);
    const readRevision = useRef(0);

    const invalidateRequests = useCallback(() => { activeContext.current = null; version.current++; }, []);

    useEffect(() => {
        activeContext.current = context;
        readRevision.current++;
        pendingAcknowledgements.clear();
        return invalidateRequests;
    }, [context, invalidateRequests, pendingAcknowledgements]);

    const setPersistentNotifications = useCallback((update: SetStateAction<PersistentNotification[]>) => {
        if (!context || activeContext.current !== context) return;
        version.current++;
        readRevision.current++;
        setSnapshot(previous => {
            if (activeContext.current !== context) return previous;
            const items = previous.context === context ? previous.items : [];
            return { context, items: typeof update === "function" ? update(items) : update,
                loading: false, failed: previous.context === context && previous.failed };
        });
    }, [context]);

    const loadPersistentNotifications = useCallback(async () => {
        if (!context || activeContext.current !== context) return;
        const request = ++version.current;
        setSnapshot(previous => ({ context, items: previous.context === context ? previous.items : [],
            loading: true, failed: previous.context === context && previous.failed }));
        try {
            const items = await NotificationService.listUnread(`${context}:${readRevision.current}`);
            if (request === version.current && activeContext.current === context) setSnapshot({ context, items: items.filter(notification => !(
                notification.entity_type === "task_item" && typeof notification.entity_id === "number"
                && pendingAcknowledgements.has(notification.entity_id)
            )), loading: false, failed: false });
        } catch (error) {
            const transient = !(error instanceof ApiResponseError) || error.status >= 500 || error.status === 408 || error.status === 429;
            if (request === version.current && activeContext.current === context) setSnapshot(previous => ({ context, items: transient && previous.context === context ? previous.items : [], loading: false, failed: true }));
        }
    }, [context, pendingAcknowledgements]);

    const owned = Boolean(context && snapshot.context === context);
    return {
        persistentNotifications: owned ? snapshot.items : [],
        setPersistentNotifications, loadPersistentNotifications,
        persistentLoadFailed: owned && snapshot.failed,
        persistentLoading: Boolean(context && (!owned || snapshot.loading)),
    };
}
